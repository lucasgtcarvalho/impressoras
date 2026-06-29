using System.Net;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using PrintMonitor.Agent.Models;

namespace PrintMonitor.Agent.Collectors;

public static class SnmpScanner
{
    private static readonly ObjectIdentifier SysName = new(".1.3.6.1.2.1.1.5.0");
    private static readonly ObjectIdentifier SysDescr = new(".1.3.6.1.2.1.1.1.0");
    private static readonly ObjectIdentifier SysUptime = new(".1.3.6.1.2.1.1.3.0");
    private static readonly ObjectIdentifier PrtGeneralSerialNumber = new(".1.3.6.1.2.1.43.5.1.1.16.0");
    private static readonly ObjectIdentifier PrtModel = new(".1.3.6.1.2.1.43.5.1.1.17.0");
    private static readonly ObjectIdentifier PrtManufacturer = new(".1.3.6.1.2.1.43.5.1.1.18.0");
    private static readonly ObjectIdentifier PrtMarkerCounterUnitTotal = new(".1.3.6.1.2.1.43.10.2.1.4.1.1");
    private static readonly ObjectIdentifier PrtMarkerCounterUnitColor = new(".1.3.6.1.2.1.43.10.2.1.4.1.2");
    private static readonly ObjectIdentifier PrtMarkerTable = new(".1.3.6.1.2.1.43.10");
    private static readonly ObjectIdentifier PrtMarkerSuppliesTable = new(".1.3.6.1.2.1.43.11");
    private static readonly ObjectIdentifier HrPrinterStatus = new(".1.3.6.1.2.1.25.3.2.1.1");
    private static readonly ObjectIdentifier HrDeviceStatus = new(".1.3.6.1.2.1.25.3.2.1.2");

    private static readonly ObjectIdentifier HpTotalPages = new(".1.3.6.1.4.1.11.2.3.9.1.1.7.0");
    private static readonly ObjectIdentifier HpMonoPages = new(".1.3.6.1.4.1.11.2.3.9.4.2.1.1.4.6.1");
    private static readonly ObjectIdentifier HpColorPages = new(".1.3.6.1.4.1.11.2.3.9.4.2.1.1.4.6.2");

    private static readonly ObjectIdentifier KyoceraTotalPages = new(".1.3.6.1.4.1.1347.43.10.2.1.4.1.1");
    private static readonly ObjectIdentifier KyoceraColorPages = new(".1.3.6.1.4.1.1347.43.10.2.1.4.1.2");

    private static readonly VersionCode SnmpVersion = VersionCode.V2;

    private static readonly TimeSpan FailFastTimeout = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan NormalTimeout = TimeSpan.FromSeconds(6);
    private static readonly TimeSpan WalkTimeout = TimeSpan.FromSeconds(8);

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

        string? sysName = null;
        try
        {
            var ct = new CancellationTokenSource(FailFastTimeout).Token;
            var result = await Messenger.GetAsync(
                SnmpVersion, endpoint, communityOctet,
                new List<Variable> { new Variable(SysName) }, ct);
            sysName = result?.FirstOrDefault()?.Data?.ToString();
        }
        catch
        {
            return (null, null, null, events);
        }

        string? serialNumber = null;
        bool isPrinter = false;
        try
        {
            var ct = new CancellationTokenSource(FailFastTimeout).Token;
            var result = await Messenger.GetAsync(
                SnmpVersion, endpoint, communityOctet,
                new List<Variable> { new Variable(PrtGeneralSerialNumber) }, ct);
            var raw = result?.FirstOrDefault()?.Data;
            if (raw is OctetString octet && !string.IsNullOrEmpty(octet.ToString()))
            {
                serialNumber = octet.ToString();
                isPrinter = true;
            }
        }
        catch { }

        if (!isPrinter)
        {
            try
            {
                var ct = new CancellationTokenSource(FailFastTimeout).Token;
                var walkTest = new List<Variable>();
                await Messenger.WalkAsync(
                    SnmpVersion, endpoint, communityOctet,
                    PrtMarkerTable, walkTest, WalkMode.WithinSubtree, ct);
                if (walkTest.Count > 0)
                    isPrinter = true;
            }
            catch { }
        }

        if (!isPrinter)
            return (null, null, null, events);

        string? sysDescr = null;
        string? model = null;
        string? manufacturer = null;
        long uptimeSeconds = 0;

        try
        {
            var ct = new CancellationTokenSource(NormalTimeout).Token;
            var results = await Messenger.GetAsync(
                SnmpVersion, endpoint, communityOctet,
                new List<Variable>
                {
                    new Variable(SysDescr),
                    new Variable(PrtModel),
                    new Variable(PrtManufacturer),
                    new Variable(SysUptime),
                }, ct);

            foreach (var v in results)
            {
                if (v.Id == SysDescr) sysDescr = v.Data?.ToString();
                else if (v.Id == PrtModel) model = (v.Data as OctetString)?.ToString();
                else if (v.Id == PrtManufacturer) manufacturer = (v.Data as OctetString)?.ToString();
                else if (v.Id == SysUptime && v.Data is TimeTicks ticks)
                    uptimeSeconds = (long)ticks.ToTimeSpan().TotalSeconds;
            }
        }
        catch { }

        if (string.IsNullOrEmpty(manufacturer))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var devDescr = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable> { new Variable(new ObjectIdentifier(".1.3.6.1.2.1.25.3.2.1.3.1")) }, ct);
                var desc = devDescr?.FirstOrDefault()?.Data?.ToString();
                if (!string.IsNullOrEmpty(desc))
                {
                    var parts = desc.Split(',');
                    if (parts.Length >= 2)
                    {
                        manufacturer = parts[0].Trim();
                        if (string.IsNullOrEmpty(model)) model = parts[1].Trim();
                    }
                }
            }
            catch { }
        }

        long totalPages = 0;
        long colorPages = 0;
        bool isColor = false;

        // Try specific OIDs first (faster)
        try
        {
            var ct = new CancellationTokenSource(NormalTimeout).Token;
            var counterResult = await Messenger.GetAsync(
                SnmpVersion, endpoint, communityOctet,
                new List<Variable>
                {
                    new Variable(PrtMarkerCounterUnitTotal),
                    new Variable(PrtMarkerCounterUnitColor),
                }, ct);

            foreach (var v in counterResult)
            {
                if (v.Id == PrtMarkerCounterUnitTotal && long.TryParse(v.Data?.ToString(), out var t))
                    totalPages = t;
                else if (v.Id == PrtMarkerCounterUnitColor && long.TryParse(v.Data?.ToString(), out var c))
                {
                    colorPages = c;
                    if (c > 0) isColor = true;
                }
            }
        }
        catch { }

        // Try HP-specific OIDs
        if (totalPages == 0)
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var hpResult = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable>
                    {
                        new Variable(HpTotalPages),
                        new Variable(HpMonoPages),
                        new Variable(HpColorPages),
                    }, ct);

                foreach (var v in hpResult)
                {
                    if (v.Id == HpTotalPages && long.TryParse(v.Data?.ToString(), out var t)) totalPages = t;
                    else if (v.Id == HpMonoPages && long.TryParse(v.Data?.ToString(), out var m)) { if (totalPages == 0) totalPages = m; }
                    else if (v.Id == HpColorPages && long.TryParse(v.Data?.ToString(), out var c)) { colorPages = c; if (c > 0) isColor = true; }
                }
            }
            catch { }

            if (totalPages == 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var kyoceraResult = await Messenger.GetAsync(
                        SnmpVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(KyoceraTotalPages),
                            new Variable(KyoceraColorPages),
                        }, ct);

                    foreach (var v in kyoceraResult)
                    {
                        if (v.Id == KyoceraTotalPages && long.TryParse(v.Data?.ToString(), out var t)) totalPages = t;
                        else if (v.Id == KyoceraColorPages && long.TryParse(v.Data?.ToString(), out var c)) { colorPages = c; if (c > 0) isColor = true; }
                    }
                }
                catch { }
            }
        }

        // Fall back to walking the marker table
        if (totalPages == 0)
        {
            try
            {
                var ct = new CancellationTokenSource(WalkTimeout).Token;
                var walkResults = new List<Variable>();
                await Messenger.WalkAsync(
                    SnmpVersion, endpoint, communityOctet,
                    PrtMarkerTable, walkResults, WalkMode.WithinSubtree, ct);

                var markerCounters = new List<long>();
                foreach (var v in walkResults)
                {
                    if (v.Id.ToString().Contains(".43.10.2.1.4.") && long.TryParse(v.Data?.ToString(), out var count))
                        markerCounters.Add(count);
                }

                if (markerCounters.Count > 0)
                {
                    totalPages = markerCounters[0];
                    if (markerCounters.Count > 1)
                    {
                        colorPages = markerCounters[1];
                        if (colorPages > 0) isColor = true;
                    }
                }
            }
            catch { }
        }

        // Determine color from supply types if not already determined
        var supplies = new SupplyInfo { PrinterIp = ip, Supplies = new List<SupplyItem>() };
        try
        {
            var ct = new CancellationTokenSource(WalkTimeout).Token;
            var suppliesWalk = new List<Variable>();
            await Messenger.WalkAsync(
                SnmpVersion, endpoint, communityOctet,
                PrtMarkerSuppliesTable, suppliesWalk, WalkMode.WithinSubtree, ct);
            ParseSupplyTable(suppliesWalk, supplies.Supplies);
        }
        catch { }

        if (!isColor)
        {
            isColor = supplies.Supplies.Any(s =>
                s.Type.Contains("color", StringComparison.OrdinalIgnoreCase) ||
                s.Type.Contains("cyan", StringComparison.OrdinalIgnoreCase) ||
                s.Type.Contains("magenta", StringComparison.OrdinalIgnoreCase) ||
                s.Type.Contains("yellow", StringComparison.OrdinalIgnoreCase));
        }

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
            if (cols.TryGetValue(5, out var maxData))
            {
                if (maxData is Integer32 maxInt) maxCapacity = maxInt.ToInt32();
                else if (maxData is Gauge32 maxGauge) maxCapacity = (int)maxGauge.ToUInt32();
            }

            int? level = null;
            if (cols.TryGetValue(6, out var levelData))
            {
                if (levelData is Integer32 lvlInt) level = lvlInt.ToInt32();
                else if (levelData is Gauge32 lvlGauge) level = (int)lvlGauge.ToUInt32();
            }

            int? levelPercent = null;
            if (level.HasValue && maxCapacity.HasValue && maxCapacity.Value > 0)
            {
                if (level.Value >= 0 && maxCapacity.Value > 0)
                    levelPercent = (int)((double)level.Value / maxCapacity.Value * 100);
            }
            else if (level.HasValue && level.Value >= 0)
            {
                levelPercent = level.Value;
            }

            string status = "ok";
            if (levelPercent.HasValue)
            {
                if (levelPercent <= 5) status = "critical";
                else if (levelPercent <= 15) status = "low";
            }

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
