using System.Net;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using PrintMonitor.Agent.Models;

namespace PrintMonitor.Agent.Collectors;

public static class SnmpScanner
{
    // OIDs
    private static readonly ObjectIdentifier SysName = new(".1.3.6.1.2.1.1.5.0");
    private static readonly ObjectIdentifier SysDescr = new(".1.3.6.1.2.1.1.1.0");
    private static readonly ObjectIdentifier PrtGeneralSerialNumber = new(".1.3.6.1.2.1.43.5.1.1.16.0");
    private static readonly ObjectIdentifier PrtModel = new(".1.3.6.1.2.1.43.5.1.1.17.0");
    private static readonly ObjectIdentifier PrtManufacturer = new(".1.3.6.1.2.1.43.5.1.1.18.0");
    private static readonly ObjectIdentifier PrtMarkerCounter = new(".1.3.6.1.2.1.43.10.2.1.4");
    private static readonly ObjectIdentifier PrtMarkerTable = new(".1.3.6.1.2.1.43.10");
    private static readonly ObjectIdentifier PrtMarkerSuppliesTable = new(".1.3.6.1.2.1.43.11");

    private static readonly VersionCode SnmpVersion = VersionCode.V2;

    public static async Task<(
        PrinterInfo? printer,
        CounterInfo? counters,
        SupplyInfo? supplies,
        List<EventInfo> events)> ScanAsync(
        string ip,
        string community,
        string version,
        int timeoutMs,
        int retries)
    {
        var endpoint = new IPEndPoint(IPAddress.Parse(ip), 161);
        var communityOctet = new OctetString(community);
        var events = new List<EventInfo>();
        var ct = CancellationToken.None;

        // Step 1: Check basic SNMP reachability via sysName
        string? sysName = null;
        try
        {
            var sysNameResult = await Messenger.GetAsync(
                SnmpVersion,
                endpoint,
                communityOctet,
                new List<Variable> { new Variable(SysName) },
                ct);
            sysName = sysNameResult?.FirstOrDefault()?.Data?.ToString();
        }
        catch
        {
            return (null, null, null, events);
        }

        // Step 2: Check if it's a printer (must respond to Printer MIB)
        string? serialNumber = null;
        try
        {
            var serialResult = await Messenger.GetAsync(
                SnmpVersion,
                endpoint,
                communityOctet,
                new List<Variable> { new Variable(PrtGeneralSerialNumber) },
                ct);
            var raw = serialResult?.FirstOrDefault()?.Data;
            if (raw is OctetString octet)
                serialNumber = octet.ToString();
            else
                return (null, null, null, events);
        }
        catch
        {
            return (null, null, null, events);
        }

        // Step 3: Get remaining identity fields
        string? sysDescr = null;
        string? model = null;
        string? manufacturer = null;
        long uptimeSeconds = 0;

        try
        {
            var results = await Messenger.GetAsync(
                SnmpVersion,
                endpoint,
                communityOctet,
                new List<Variable>
                {
                    new Variable(SysDescr),
                    new Variable(PrtModel),
                    new Variable(PrtManufacturer),
                },
                ct);

            foreach (var v in results)
            {
                if (v.Id == SysDescr) sysDescr = v.Data?.ToString();
                else if (v.Id == PrtModel) model = (v.Data as OctetString)?.ToString();
                else if (v.Id == PrtManufacturer) manufacturer = (v.Data as OctetString)?.ToString();
            }
        }
        catch { /* best-effort */ }

        try
        {
            var uptimeResult = await Messenger.GetAsync(
                SnmpVersion,
                endpoint,
                communityOctet,
                new List<Variable> { new Variable(new ObjectIdentifier(".1.3.6.1.2.1.1.3.0")) },
                ct);
            var raw = uptimeResult?.FirstOrDefault()?.Data;
            if (raw is TimeTicks ticks)
                uptimeSeconds = (long)ticks.ToTimeSpan().TotalSeconds;
        }
        catch { /* best-effort */ }

        // Step 4: Walk marker table for page counters
        var markerCounters = new List<long>();
        var isColor = false;
        try
        {
            var walkResults = new List<Variable>();
            await Messenger.WalkAsync(
                SnmpVersion,
                endpoint,
                communityOctet,
                PrtMarkerCounter,
                walkResults,
                WalkMode.WithinSubtree,
                ct);

            foreach (var v in walkResults)
            {
                if (long.TryParse(v.Data?.ToString(), out var count))
                    markerCounters.Add(count);
            }
        }
        catch { /* best-effort */ }

        // Step 5: Walk supplies table
        var supplies = new SupplyInfo { PrinterIp = ip, Supplies = new List<SupplyItem>() };
        try
        {
            var suppliesWalk = new List<Variable>();
            await Messenger.WalkAsync(
                SnmpVersion,
                endpoint,
                communityOctet,
                PrtMarkerSuppliesTable,
                suppliesWalk,
                WalkMode.WithinSubtree,
                ct);

            // Parse supply table rows
            // prtMarkerSuppliesTable has entries:
            //   prtMarkerSuppliesIndex (1)
            //   prtMarkerSuppliesType (2)
            //   prtMarkerSuppliesDescription (3)
            //   prtMarkerSuppliesSupplyUnit (4)
            //   prtMarkerSuppliesMaxCapacity (5)
            //   prtMarkerSuppliesLevel (6)
            ParseSupplyTable(suppliesWalk, supplies.Supplies);
        }
        catch { /* best-effort */ }

        // Determine color capability from marker table or supply types
        isColor = supplies.Supplies.Any(s =>
            s.Type.Contains("color", StringComparison.OrdinalIgnoreCase) ||
            s.Type.Contains("cyan", StringComparison.OrdinalIgnoreCase) ||
            s.Type.Contains("magenta", StringComparison.OrdinalIgnoreCase) ||
            s.Type.Contains("yellow", StringComparison.OrdinalIgnoreCase));

        // Build result
        var hostname = sysName;
        var displayName = !string.IsNullOrEmpty(hostname) && !hostname.StartsWith("PRINTER")
            ? hostname
            : $"Printer-{ip.Replace(".", "-")}";

        var printer = new PrinterInfo
        {
            IpAddress = ip,
            Hostname = hostname,
            Name = displayName,
            Manufacturer = manufacturer,
            Model = model,
            SerialNumber = serialNumber,
            Status = "online",
            StatusDetail = "idle",
            UptimeSeconds = uptimeSeconds,
            IsMonochrome = !isColor,
        };

        // Calculate page counters
        long totalPages = markerCounters.Count > 0 ? markerCounters[0] : 0;
        long colorPages = 0;
        if (isColor && markerCounters.Count > 1)
        {
            colorPages = markerCounters[1];
        }

        var counters = new CounterInfo
        {
            PrinterIp = ip,
            TotalPages = totalPages,
            MonoPages = totalPages - colorPages,
            ColorPages = colorPages,
            CollectedAt = DateTime.UtcNow,
        };

        return (printer, counters, supplies, events);
    }

    private static void ParseSupplyTable(List<Variable> walkResults, List<SupplyItem> supplies)
    {
        var rows = new Dictionary<int, Dictionary<int, ISnmpData>>();

        foreach (var v in walkResults)
        {
            var nums = v.Id.ToNumerical();
            if (nums.Length < 12) continue;

            int column = (int)nums[10];
            int row = (int)nums[11];

            if (!rows.ContainsKey(row))
                rows[row] = new Dictionary<int, ISnmpData>();

            rows[row][column] = v.Data;
        }

        foreach (var (rowIdx, cols) in rows)
        {
            int? supplyType = null;
            if (cols.TryGetValue(2, out var typeData) && typeData is Integer32 intVal)
                supplyType = intVal.ToInt32();

            if (supplyType == null || supplyType == 1 || supplyType == 2)
                continue;

            string? description = null;
            if (cols.TryGetValue(3, out var descData) && descData is OctetString descOctet)
                description = descOctet.ToString();

            int? maxCapacity = null;
            if (cols.TryGetValue(5, out var maxData) && maxData is Integer32 maxInt)
                maxCapacity = maxInt.ToInt32();
            else if (cols.TryGetValue(5, out maxData) && maxData is Gauge32 maxGauge)
                maxCapacity = (int)maxGauge.ToUInt32();

            int? level = null;
            if (cols.TryGetValue(6, out var levelData))
            {
                if (levelData is Integer32 lvlInt)
                    level = lvlInt.ToInt32();
                else if (levelData is Gauge32 lvlGauge)
                    level = (int)lvlGauge.ToUInt32();
            }

            int? levelPercent = null;
            if (level.HasValue && maxCapacity.HasValue && maxCapacity.Value > 0)
            {
                // Some printers report -2 (meaning unknown) or -1 (meaning below normal)
                if (level.Value >= 0 && maxCapacity.Value > 0)
                    levelPercent = (int)((double)level.Value / maxCapacity.Value * 100);
            }
            else if (level.HasValue && level.Value >= 0)
            {
                levelPercent = level.Value; // Some printers report percentage directly
            }

            // Determine status
            string status = "ok";
            if (levelPercent.HasValue)
            {
                if (levelPercent <= 5) status = "critical";
                else if (levelPercent <= 15) status = "low";
            }

            // Map supply type to readable name
            var (typeName, readableName) = MapSupplyType(supplyType.Value, description);

            supplies.Add(new SupplyItem
            {
                Type = typeName,
                Name = readableName ?? description ?? $"Supply {rowIdx}",
                LevelPercent = Math.Clamp(levelPercent ?? 100, 0, 100),
                LevelRemaining = level,
                MaxCapacity = maxCapacity,
                Status = status,
            });
        }
    }

    private static (string typeName, string? readableName) MapSupplyType(int supplyType, string? description)
    {
        // RFC 3805 prtMarkerSuppliesType values
        return supplyType switch
        {
            3 => ("toner", description),
            4 => ("waste_toner", description),
            5 => ("ink", description),
            6 => ("ink_cartridge", description),
            7 => ("ribbon", description),
            8 => ("ribbon_wax", description),
            9 => ("ribbon_wax_thermal", description),
            10 => ("fuser", description),
            11 => ("corona_wire", description),
            12 => ("corona_wire_roller", description),
            13 => ("cleaner_pad", description),
            14 => ("cleaner_pad_1", description),
            15 => ("cleaner_pad_2", description),
            16 => ("guide_pad_roller", description),
            17 => ("transfer_roller", description),
            18 => ("toner_cartridge", description),
            19 => ("drum", description),
            20 => ("developer", description),
            _ => ($"supply_{supplyType}", description),
        };
    }
}
