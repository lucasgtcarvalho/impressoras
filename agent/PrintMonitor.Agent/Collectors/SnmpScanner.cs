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
    private static readonly ObjectIdentifier PrtGeneralTable = new(".1.3.6.1.2.1.43.5.1.1");
    private static readonly ObjectIdentifier PrtGeneralSerialNumber = new(".1.3.6.1.2.1.43.5.1.1.16.0");
    private static readonly ObjectIdentifier PrtModel = new(".1.3.6.1.2.1.43.5.1.1.17.0");
    private static readonly ObjectIdentifier PrtManufacturer = new(".1.3.6.1.2.1.43.5.1.1.18.0");
    private static readonly ObjectIdentifier PrtInterpreterVersion = new(".1.3.6.1.2.1.43.15.1.1.4");
    private static readonly ObjectIdentifier PrtMarkerCounterUnitTotal = new(".1.3.6.1.2.1.43.10.2.1.4.1.1");
    private static readonly ObjectIdentifier PrtMarkerCounterUnitColor = new(".1.3.6.1.2.1.43.10.2.1.4.1.2");
    private static readonly ObjectIdentifier PrtMarkerTable = new(".1.3.6.1.2.1.43.10");
    private static readonly ObjectIdentifier PrtMarkerSuppliesTable = new(".1.3.6.1.2.1.43.11");
    private static readonly ObjectIdentifier HrPrinterStatus = new(".1.3.6.1.2.1.25.3.2.1.1");
    private static readonly ObjectIdentifier HrDeviceStatus = new(".1.3.6.1.2.1.25.3.2.1.2");

    // Vendor-specific counter OIDs
    private static readonly ObjectIdentifier HpTotalPages = new(".1.3.6.1.4.1.11.2.3.9.1.1.7.0");
    private static readonly ObjectIdentifier HpMonoPages = new(".1.3.6.1.4.1.11.2.3.9.4.2.1.1.4.6.1");
    private static readonly ObjectIdentifier HpColorPages = new(".1.3.6.1.4.1.11.2.3.9.4.2.1.1.4.6.2");

    private static readonly ObjectIdentifier KyoceraTotalPages = new(".1.3.6.1.4.1.1347.43.10.2.1.4.1.1");
    private static readonly ObjectIdentifier KyoceraColorPages = new(".1.3.6.1.4.1.1347.43.10.2.1.4.1.2");

    // Entity MIB fallback for identity data
    private static readonly ObjectIdentifier EntPhysicalDescr = new(".1.3.6.1.2.1.47.1.1.1.1.2");
    private static readonly ObjectIdentifier EntPhysicalSerialNum = new(".1.3.6.1.2.1.47.1.1.1.1.11");
    private static readonly ObjectIdentifier EntPhysicalModelName = new(".1.3.6.1.2.1.47.1.1.1.1.13");
    private static readonly ObjectIdentifier EntPhysicalTable = new(".1.3.6.1.2.1.47.1.1.1");
    private static readonly ObjectIdentifier EntPhysicalFirmwareRev = new(".1.3.6.1.2.1.47.1.1.1.1.9");

    // Interface/MAC table
    private static readonly ObjectIdentifier IfPhysAddress = new(".1.3.6.1.2.1.2.2.1.6");
    private static readonly ObjectIdentifier IfTable = new(".1.3.6.1.2.1.2.2");

    // Host resources printer detection
    private static readonly ObjectIdentifier HrDeviceDescr = new(".1.3.6.1.2.1.25.3.2.1.3");
    private static readonly ObjectIdentifier HrDeviceType = new(".1.3.6.1.2.1.25.3.2.1.2");

    // Canon enterprise OIDs
    private static readonly ObjectIdentifier CanonTotalPages = new(".1.3.6.1.4.1.1602.1.11.1.1.7.1.1");
    private static readonly ObjectIdentifier CanonSerial = new(".1.3.6.1.4.1.1602.1.11.1.1.1.1.1");

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
        string? prtModel = null;
        string? prtManufacturer = null;
        bool isPrinter = false;

        // Quick check: try direct GET of prtGeneral serial at index .16.0
        try
        {
            var ct = new CancellationTokenSource(FailFastTimeout).Token;
            var quick = await Messenger.GetAsync(
                SnmpVersion, endpoint, communityOctet,
                new List<Variable> { new Variable(PrtGeneralSerialNumber) }, ct);
            var raw = quick?.FirstOrDefault()?.Data;
            if (raw is OctetString octet && !string.IsNullOrEmpty(octet.ToString()))
            {
                serialNumber = octet.ToString();
                isPrinter = true;
            }
        }
        catch { }

        // If direct GET failed, walk the prtGeneralTable to find data at any index
        if (string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(WalkTimeout).Token;
                var prtWalk = new List<Variable>();
                await Messenger.WalkAsync(
                    SnmpVersion, endpoint, communityOctet,
                    PrtGeneralTable, prtWalk, WalkMode.WithinSubtree, ct);
                foreach (var v in prtWalk)
                {
                    var data = v.Data as OctetString;
                    if (data == null || string.IsNullOrEmpty(data.ToString())) continue;
                    var val = data.ToString();
                    var oidStr = v.Id.ToString();
                    if (oidStr.Contains(".43.5.1.1.16.") && string.IsNullOrEmpty(serialNumber))
                        serialNumber = val;
                    if (oidStr.Contains(".43.5.1.1.17.") && string.IsNullOrEmpty(prtModel))
                        prtModel = val;
                    if (oidStr.Contains(".43.5.1.1.18.") && string.IsNullOrEmpty(prtManufacturer))
                        prtManufacturer = val;
                }
                // Some vendors (Kyocera) swap serial/model columns vs RFC.
                // Heuristic: detect and swap. A model name typically has spaces or hyphens and known prefixes;
                // a serial number is typically compact alphanumeric without spaces.
                if (!string.IsNullOrEmpty(serialNumber) && !string.IsNullOrEmpty(prtModel))
                {
                    bool col16LooksLikeModel = serialNumber.Contains(' ') ||
                        System.Text.RegularExpressions.Regex.IsMatch(serialNumber,
                            @"^(ECOSYS|TASKalfa|FS-|CS-|LP-|DP-|KIP|KM-|TK-)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    bool col17LooksLikeSerial = !prtModel.Contains(' ') &&
                        System.Text.RegularExpressions.Regex.IsMatch(prtModel, @"^[A-Z0-9]{6,15}$");
                    if (col16LooksLikeModel && col17LooksLikeSerial)
                    {
                        (serialNumber, prtModel) = (prtModel, serialNumber);
                    }
                }
                if (!string.IsNullOrEmpty(serialNumber) || !string.IsNullOrEmpty(prtModel))
                    isPrinter = true;
            }
            catch { }
        }

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

        // Fallback: use hrDeviceDescr to detect printers by description keywords
        if (!isPrinter)
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var hrWalk = new List<Variable>();
                await Messenger.WalkAsync(
                    SnmpVersion, endpoint, communityOctet,
                    HrDeviceDescr, hrWalk, WalkMode.WithinSubtree, ct);
                var printerKeywords = new[] { "printer", "laser", "mfp", "multifunction", "laserjet",
                    "lasershot", "imageclass", "imagerunner", "laserwriter", "workgroup",
                    "ecosys", "taskalfa", "fs-", "cs-", "copier", "canon" };
                foreach (var v in hrWalk)
                {
                    var desc = v.Data?.ToString() ?? "";
                    if (printerKeywords.Any(k => desc.IndexOf(k, StringComparison.OrdinalIgnoreCase) >= 0))
                    {
                        isPrinter = true;
                        break;
                    }
                }
            }
            catch { }
        }

        // Fallback: check sysDescr for printer keywords
        if (!isPrinter)
        {
            try
            {
                var ct = new CancellationTokenSource(FailFastTimeout).Token;
                var sysResult = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable> { new Variable(SysDescr) }, ct);
                var desc = sysResult?.FirstOrDefault()?.Data?.ToString() ?? "";
                var printerKeywords = new[] { "printer", "laser", "mfp", "multifunction", "laserjet",
                    "lasershot", "imageclass", "imagerunner", "ecosys", "taskalfa",
                    "fs-", "cs-", "copier", "network print", "lips", "pcl", "postscript", "canon" };
                if (printerKeywords.Any(k => desc.IndexOf(k, StringComparison.OrdinalIgnoreCase) >= 0))
                    isPrinter = true;
            }
            catch { }
        }

        // Fallback: try Canon-specific enterprise OIDs
        if (!isPrinter)
        {
            try
            {
                var ct = new CancellationTokenSource(FailFastTimeout).Token;
                var canonResult = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable>
                    {
                        new Variable(CanonTotalPages),
                        new Variable(CanonSerial),
                    }, ct);
                foreach (var v in canonResult)
                {
                    if (v.Data != null)
                    {
                        isPrinter = true;
                        break;
                    }
                }
            }
            catch { }
        }

        // Fallback: check hrDeviceType for printer type
        if (!isPrinter)
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var hrTypeWalk = new List<Variable>();
                await Messenger.WalkAsync(
                    SnmpVersion, endpoint, communityOctet,
                    HrDeviceType, hrTypeWalk, WalkMode.WithinSubtree, ct);
                // hrDeviceType values for printers: .1.3.6.1.2.1.25.3.1.5 (printer), .1.3.6.1.2.1.25.3.1.6 (laser printer)
                foreach (var v in hrTypeWalk)
                {
                    var oidStr = v.Data?.ToString() ?? "";
                    if (oidStr.Contains(".25.3.1.5") || oidStr.Contains(".25.3.1.6"))
                    {
                        isPrinter = true;
                        break;
                    }
                }
            }
            catch { }
        }

        // Fallback: try Entity MIB for serial number (walk entPhysicalTable for all entries)
        if (string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(WalkTimeout).Token;
                var entWalk = new List<Variable>();
                await Messenger.WalkAsync(
                    SnmpVersion, endpoint, communityOctet,
                    EntPhysicalTable, entWalk, WalkMode.WithinSubtree, ct);
                foreach (var v in entWalk)
                {
                    if (v.Id == EntPhysicalSerialNum && v.Data is OctetString s && !string.IsNullOrEmpty(s.ToString()))
                    {
                        serialNumber = s.ToString();
                        isPrinter = true;
                        break;
                    }
                }
            }
            catch { }
        }

        // Fallback: try Canon-specific serial OID
        if (string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var canonResult = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable> { new Variable(CanonSerial) }, ct);
                var raw = canonResult?.FirstOrDefault()?.Data;
                if (raw is OctetString o && !string.IsNullOrEmpty(o.ToString()))
                {
                    serialNumber = o.ToString();
                    isPrinter = true;
                }
            }
            catch { }
        }

        if (!isPrinter)
            return (null, null, null, events);

        string? sysDescr = null;
        string? model = prtModel;
        string? manufacturer = prtManufacturer;
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
                else if (v.Id == PrtModel) model ??= (v.Data as OctetString)?.ToString();
                else if (v.Id == PrtManufacturer) manufacturer ??= (v.Data as OctetString)?.ToString();
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
                    else
                    {
                        if (string.IsNullOrEmpty(model)) model = desc.Trim();
                    }
                }
            }
            catch { }
        }

        // Entity MIB fallback for manufacturer / model / firmware
        if (string.IsNullOrEmpty(manufacturer) || string.IsNullOrEmpty(model) || string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var entGet = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable>
                    {
                        new Variable(EntPhysicalDescr),
                        new Variable(EntPhysicalModelName),
                        new Variable(EntPhysicalSerialNum),
                    }, ct);

                foreach (var v in entGet)
                {
                    var data = v.Data as OctetString;
                    if (data == null || string.IsNullOrEmpty(data.ToString())) continue;

                    if (v.Id == EntPhysicalModelName)
                        model ??= data.ToString();
                    else if (v.Id == EntPhysicalDescr && string.IsNullOrEmpty(manufacturer))
                    {
                        var raw = data.ToString();
                        var parts = raw.Split(new[] { ' ' }, 2);
                        if (parts.Length == 2)
                        {
                            manufacturer = parts[0];
                            model ??= raw;
                        }
                        else
                        {
                            model ??= raw;
                        }
                    }
                    else if (v.Id == EntPhysicalDescr)
                    {
                        model ??= data.ToString();
                    }
                    else if (v.Id == EntPhysicalSerialNum)
                        serialNumber ??= data.ToString();
                }
            }
            catch { }
        }

        // Last resort: parse manufacturer and model from sysDescr
        if (string.IsNullOrEmpty(manufacturer) || string.IsNullOrEmpty(model))
        {
            if (!string.IsNullOrEmpty(sysDescr))
            {
                var knownBrands = new[] { "HP", "Kyocera", "EPSON", "Canon", "Brother", "Xerox", "Ricoh",
                    "Lexmark", "Samsung", "Dell", "Konica Minolta", "Toshiba", "Sharp", "OKI", "Panasonic",
                    "Fuji Xerox", "Epson", "Zebra" };
                foreach (var brand in knownBrands)
                {
                    if (sysDescr.IndexOf(brand, StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        if (string.IsNullOrEmpty(manufacturer)) manufacturer = brand;
                        var line = sysDescr.Split('\n', '\r')[0];
                        var idx = line.IndexOf(brand, StringComparison.OrdinalIgnoreCase);
                        if (idx >= 0 && string.IsNullOrEmpty(model))
                        {
                            var candidate = line.Substring(idx).Trim();
                            var end = candidate.IndexOfAny(new[] { ',', ';', '-' });
                            if (end > 0) candidate = candidate[..end].Trim();
                            model = candidate.Length <= 80 ? candidate : candidate[..80];
                        }
                        break;
                    }
                }
            }
        }

        // MAC address: walk ifTable for ifPhysAddress
        string? macAddress = null;
        try
        {
            var ct = new CancellationTokenSource(NormalTimeout).Token;
            var ifWalk = new List<Variable>();
            await Messenger.WalkAsync(
                SnmpVersion, endpoint, communityOctet,
                IfTable, ifWalk, WalkMode.WithinSubtree, ct);
            foreach (var v in ifWalk)
            {
                if (v.Id == IfPhysAddress && v.Data is OctetString m)
                {
                    var raw = m.ToBytes();
                    if (raw.Length == 6 && raw.Any(b => b != 0))
                    {
                        macAddress = string.Join(":", raw.Select(b => b.ToString("X2")));
                        break;
                    }
                }
            }
        }
        catch { }

        // Hostname fallback: DNS reverse lookup if sysName is empty
        if (string.IsNullOrEmpty(sysName))
        {
            try
            {
                var hostEntry = System.Net.Dns.GetHostEntry(IPAddress.Parse(ip));
                if (!string.IsNullOrEmpty(hostEntry.HostName) &&
                    !hostEntry.HostName.Equals(ip, StringComparison.OrdinalIgnoreCase))
                    sysName = hostEntry.HostName.Split('.')[0];
            }
            catch { }
        }

        // Firmware version: walk prtInterpreterVersion table
        string? firmware = null;
        try
        {
            var ct = new CancellationTokenSource(NormalTimeout).Token;
            var fwWalk = new List<Variable>();
            await Messenger.WalkAsync(
                SnmpVersion, endpoint, communityOctet,
                PrtInterpreterVersion, fwWalk, WalkMode.WithinSubtree, ct);
            string? best = null;
            foreach (var v in fwWalk)
            {
                var data = v.Data as OctetString;
                if (data != null && !string.IsNullOrEmpty(data.ToString()))
                {
                    var val = data.ToString();
                    // Pick the longest version string (most likely the main firmware)
                    if (best == null || val.Length > best.Length)
                        best = val;
                }
            }
            firmware = best;
        }
        catch { }

        if (string.IsNullOrEmpty(firmware))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var fwResult = await Messenger.GetAsync(
                    SnmpVersion, endpoint, communityOctet,
                    new List<Variable> { new Variable(EntPhysicalFirmwareRev) }, ct);
                var data = fwResult?.FirstOrDefault()?.Data as OctetString;
                if (data != null && !string.IsNullOrEmpty(data.ToString()))
                    firmware = data.ToString();
            }
            catch { }
        }

        if (string.IsNullOrEmpty(firmware) && !string.IsNullOrEmpty(sysDescr))
        {
            var fwMatch = System.Text.RegularExpressions.Regex.Match(sysDescr,
                @"(?:Firmware|F/W|FW|Rev|Version|Ver)[.:\s]*([\w\.\-]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (fwMatch.Success)
                firmware = fwMatch.Groups[1].Value;
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

                if (totalPages == 0)
                {
                    try
                    {
                        var ct = new CancellationTokenSource(NormalTimeout).Token;
                        var canonResult = await Messenger.GetAsync(
                            SnmpVersion, endpoint, communityOctet,
                            new List<Variable>
                            {
                                new Variable(CanonTotalPages),
                            }, ct);

                        foreach (var v in canonResult)
                        {
                            if (v.Id == CanonTotalPages && long.TryParse(v.Data?.ToString(), out var t)) totalPages = t;
                        }
                    }
                    catch { }
                }
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
            MacAddress = macAddress,
            Manufacturer = manufacturer,
            Model = model,
            SerialNumber = serialNumber,
            FirmwareVersion = firmware,
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
