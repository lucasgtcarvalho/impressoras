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

    // Kyocera enterprise OIDs (prints + copies, not engine total)
    private static readonly ObjectIdentifier KyoceraTotalPrints = new(".1.3.6.1.4.1.1347.42.3.1.1.1.1.1");
    private static readonly ObjectIdentifier KyoceraTotalCopies = new(".1.3.6.1.4.1.1347.42.3.1.1.1.1.2");
    private static readonly ObjectIdentifier KyoceraMonoPrints = new(".1.3.6.1.4.1.1347.42.3.1.2.1.1.1.1");
    private static readonly ObjectIdentifier KyoceraMonoCopies = new(".1.3.6.1.4.1.1347.42.3.1.2.1.1.2.1");
    private static readonly ObjectIdentifier KyoceraColorPrints = new(".1.3.6.1.4.1.1347.42.3.1.2.1.1.1.3");
    private static readonly ObjectIdentifier KyoceraColorCopies = new(".1.3.6.1.4.1.1347.42.3.1.2.1.1.2.3");
    private static readonly ObjectIdentifier KyoceraTotalAlt = new(".1.3.6.1.4.1.1347.43.3.1.1.1.1.1");
    private static readonly ObjectIdentifier KyoceraSerial = new(".1.3.6.1.4.1.1347.43.5.1.1.28");

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
    private static readonly ObjectIdentifier CanonMonoPages = new(".1.3.6.1.4.1.1602.1.11.1.3.1.4.113");
    private static readonly ObjectIdentifier CanonColorPages = new(".1.3.6.1.4.1.1602.1.11.1.3.1.4.123");
    private static readonly ObjectIdentifier CanonAltTotalPages = new(".1.3.6.1.4.1.1602.1.11.1.3.1.4.1");
    private static readonly ObjectIdentifier CanonMonoAlt = new(".1.3.6.1.4.1.1602.1.11.1.3.1.4.2");
    private static readonly ObjectIdentifier CanonColorAlt = new(".1.3.6.1.4.1.1602.1.11.1.3.1.4.3");
    private static readonly ObjectIdentifier CanonSerial = new(".1.3.6.1.4.1.1602.1.11.1.1.1.1.1");
    private static readonly ObjectIdentifier CanonImgProgSerial = new(".1.3.6.1.4.1.1602.1.2.1.4.1.3.0");
    private static readonly ObjectIdentifier CanonImgProgDeviceId = new(".1.3.6.1.4.1.1602.1.2.1.4.1.5.0");

    // Epson enterprise OIDs
    private static readonly ObjectIdentifier EpsonMonoPages = new(".1.3.6.1.4.1.1248.1.2.2.27.1.1.3.1.1");
    private static readonly ObjectIdentifier EpsonColorPages = new(".1.3.6.1.4.1.1248.1.2.2.27.1.1.4.1.1");
    private static readonly ObjectIdentifier EpsonMonoAlt = new(".1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1");
    private static readonly ObjectIdentifier EpsonColorAlt = new(".1.3.6.1.4.1.1248.1.2.2.44.1.1.2.2");

    // Brother enterprise OIDs
    private static readonly ObjectIdentifier BrotherTotalPages = new(".1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11");
    private static readonly ObjectIdentifier BrotherMonoPages = new(".1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.1.0");
    private static readonly ObjectIdentifier BrotherColorPages = new(".1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.2.0");

    // Oki Data enterprise OIDs
    private static readonly ObjectIdentifier OkiMonoPages = new(".1.3.6.1.4.1.2001.1.1.1.1.11.1.5.1.1.0");
    private static readonly ObjectIdentifier OkiColorPages = new(".1.3.6.1.4.1.2001.1.1.1.1.11.1.5.1.2.0");

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

        // Try v2c first, fall back to v1 if it fails (some printers only support v1)
        static async Task<string?> TryGetSysName(IPEndPoint ep, OctetString comm, VersionCode ver, int timeoutSec)
        {
            try
            {
                var ct = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSec)).Token;
                var result = await Messenger.GetAsync(
                    ver, ep, comm,
                    new List<Variable> { new Variable(SysName) }, ct);
                return result?.FirstOrDefault()?.Data?.ToString();
            }
            catch
            {
                return null;
            }
        }

        var primaryVersion = version?.ToLowerInvariant() switch
        {
            "v1" => VersionCode.V1,
            _ => VersionCode.V2,
        };
        var fallbackVersion = primaryVersion == VersionCode.V1 ? VersionCode.V2 : VersionCode.V1;

        var workingVersion = primaryVersion;
        sysName = await TryGetSysName(endpoint, communityOctet, primaryVersion, 3);
        if (sysName == null)
        {
            workingVersion = fallbackVersion;
            sysName = await TryGetSysName(endpoint, communityOctet, fallbackVersion, 3);
        }

        if (sysName == null)
            return (null, null, null, events);

        string? serialNumber = null;
        string? prtModel = null;
        string? prtManufacturer = null;
        bool isPrinter = false;

        // Quick check: try direct GET of prtGeneral serial (.16.0), model (.17.0), manufacturer (.18.0)
        try
        {
            var ct = new CancellationTokenSource(FailFastTimeout).Token;
            var quick = await Messenger.GetAsync(
                workingVersion, endpoint, communityOctet,
                new List<Variable>
                {
                    new Variable(PrtGeneralSerialNumber),
                    new Variable(PrtModel),
                    new Variable(PrtManufacturer),
                }, ct);
            if (quick != null)
            {
                foreach (var v in quick)
                {
                    if (v.Data is OctetString octet && !string.IsNullOrEmpty(octet.ToString()))
                    {
                        var val = octet.ToString();
                        if (v.Id == PrtGeneralSerialNumber && string.IsNullOrEmpty(serialNumber))
                            serialNumber = val;
                        else if (v.Id == PrtModel && string.IsNullOrEmpty(prtModel))
                            prtModel = val;
                        else if (v.Id == PrtManufacturer && string.IsNullOrEmpty(prtManufacturer))
                            prtManufacturer = val;
                    }
                }
                if (!string.IsNullOrEmpty(serialNumber) || !string.IsNullOrEmpty(prtModel))
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
                    workingVersion, endpoint, communityOctet,
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
                if (!string.IsNullOrEmpty(serialNumber) || !string.IsNullOrEmpty(prtModel))
                    isPrinter = true;
            }
            catch { }
        }

        // Some vendors (Kyocera) swap serial/model columns vs RFC.
        // Heuristic: detect and swap. A model name typically has spaces or hyphens and known prefixes;
        // a serial number is typically compact alphanumeric without spaces.
        if (!string.IsNullOrEmpty(serialNumber) && !string.IsNullOrEmpty(prtModel))
        {
            bool col16LooksLikeModel = serialNumber.Contains(' ') ||
                System.Text.RegularExpressions.Regex.IsMatch(serialNumber,
                    @"^(ECOSYS|TASKalfa|FS-|CS-|LP-|DP-|KIP|KM-|TK-|OKI-|oki-)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            bool col17LooksLikeSerial = !prtModel.Contains(' ') &&
                System.Text.RegularExpressions.Regex.IsMatch(prtModel, @"^[A-Z0-9]{6,15}$");
            if (col16LooksLikeModel && col17LooksLikeSerial)
            {
                (serialNumber, prtModel) = (prtModel, serialNumber);
            }
        }

        if (!isPrinter)
        {
            try
            {
                var ct = new CancellationTokenSource(FailFastTimeout).Token;
                var walkTest = new List<Variable>();
                await Messenger.WalkAsync(
                    workingVersion, endpoint, communityOctet,
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
                    workingVersion, endpoint, communityOctet,
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
                    workingVersion, endpoint, communityOctet,
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
                    workingVersion, endpoint, communityOctet,
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
                    workingVersion, endpoint, communityOctet,
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

        // Fallback: walk entPhysicalTable for serial, model, manufacturer (fix: prefix match, since WalkAsync appends index suffix)
        if (string.IsNullOrEmpty(serialNumber) || string.IsNullOrEmpty(prtModel))
        {
            try
            {
                var ct = new CancellationTokenSource(WalkTimeout).Token;
                var entWalk = new List<Variable>();
                await Messenger.WalkAsync(
                    workingVersion, endpoint, communityOctet,
                    EntPhysicalTable, entWalk, WalkMode.WithinSubtree, ct);
                foreach (var v in entWalk)
                {
                    if (v.Data is not OctetString s || string.IsNullOrEmpty(s.ToString())) continue;
                    var val = s.ToString();
                    var oidStr = v.Id.ToString();
                    // entPhysicalSerialNum (.47.1.1.1.1.11.x)
                    if (string.IsNullOrEmpty(serialNumber) && oidStr.Contains(".47.1.1.1.1.11."))
                    {
                        serialNumber = val;
                        isPrinter = true;
                    }
                    // entPhysicalModelName (.47.1.1.1.1.13.x)
                    if (string.IsNullOrEmpty(prtModel) && oidStr.Contains(".47.1.1.1.1.13."))
                    {
                        prtModel = val;
                        isPrinter = true;
                    }
                    // entPhysicalDescr (.47.1.1.1.1.2.x) — use as model if nothing more specific found
                    if (string.IsNullOrEmpty(prtModel) && oidStr.Contains(".47.1.1.1.1.2."))
                    {
                        prtModel = val;
                        isPrinter = true;
                    }
                }
            }
            catch { }
        }

        // Fallback: try Canon-specific serial OID (imageRUNNER)
        if (string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var canonResult = await Messenger.GetAsync(
                    workingVersion, endpoint, communityOctet,
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

        // Fallback: try Canon imagePROGRAF (large-format) serial OIDs
        if (string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var canonResult = await Messenger.GetAsync(
                    workingVersion, endpoint, communityOctet,
                    new List<Variable>
                    {
                        new Variable(CanonImgProgSerial),
                        new Variable(CanonImgProgDeviceId),
                    }, ct);
                foreach (var v in canonResult)
                {
                    if (v.Data is OctetString o && !string.IsNullOrEmpty(o.ToString()))
                    {
                        serialNumber = o.ToString();
                        isPrinter = true;
                        break;
                    }
                }
            }
            catch { }
        }

        // Fallback: try Kyocera-specific serial OID
        if (string.IsNullOrEmpty(serialNumber))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var kyoceraResult = await Messenger.GetAsync(
                    workingVersion, endpoint, communityOctet,
                    new List<Variable> { new Variable(KyoceraSerial) }, ct);
                var raw = kyoceraResult?.FirstOrDefault()?.Data;
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
                workingVersion, endpoint, communityOctet,
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

        if (string.IsNullOrEmpty(manufacturer) || manufacturer == "0" || string.IsNullOrEmpty(model))
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var devWalk = new List<Variable>();
                await Messenger.WalkAsync(
                    workingVersion, endpoint, communityOctet,
                    HrDeviceDescr, devWalk, WalkMode.WithinSubtree, ct);
                foreach (var v in devWalk)
                {
                    var desc = v.Data?.ToString();
                    if (string.IsNullOrEmpty(desc)) continue;
                    if (string.IsNullOrEmpty(model) || IsInternalModelCode(model) ||
                        (!model.Contains(' ') && model.Contains('-') &&
                         System.Text.RegularExpressions.Regex.IsMatch(model.Split('-')[0],
                             @"^(ECOSYS|TASKALFA|FS|CS|LP|DP|KIP|KM|TK|OKI|oki|[A-Z]{2,5})$")))
                    {
                        var parts = desc.Split(',');
                        if (parts.Length >= 2)
                        {
                            if (string.IsNullOrEmpty(manufacturer)) manufacturer = parts[0].Trim();
                            model = parts[1].Trim();
                        }
                        else
                        {
                            model = desc.Trim();
                        }
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
                    workingVersion, endpoint, communityOctet,
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

            // Walk entPhysicalTable if direct GET returned nothing (some printers require walking)
            if (string.IsNullOrEmpty(model) || string.IsNullOrEmpty(serialNumber))
            {
                try
                {
                    var ct = new CancellationTokenSource(WalkTimeout).Token;
                    var entWalk = new List<Variable>();
                    await Messenger.WalkAsync(
                        workingVersion, endpoint, communityOctet,
                        EntPhysicalTable, entWalk, WalkMode.WithinSubtree, ct);
                    foreach (var v in entWalk)
                    {
                        if (v.Data is not OctetString s || string.IsNullOrEmpty(s.ToString())) continue;
                        var val = s.ToString();
                        var oidStr = v.Id.ToString();
                        if (string.IsNullOrEmpty(serialNumber) && oidStr.Contains(".47.1.1.1.1.11."))
                            serialNumber = val;
                        if (string.IsNullOrEmpty(model) && oidStr.Contains(".47.1.1.1.1.13."))
                            model = val;
                        if (string.IsNullOrEmpty(model) && oidStr.Contains(".47.1.1.1.1.2."))
                            model = val;
                        if (string.IsNullOrEmpty(manufacturer) && oidStr.Contains(".47.1.1.1.1.2."))
                        {
                            var raw = val;
                            var parts = raw.Split(new[] { ' ' }, 2);
                            if (parts.Length == 2) manufacturer = parts[0];
                        }
                    }
                }
                catch { }
            }
        }

        // Last resort: parse manufacturer and model from sysDescr
        if (string.IsNullOrEmpty(manufacturer) || string.IsNullOrEmpty(model) || string.IsNullOrEmpty(serialNumber))
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
                            var end = candidate.IndexOfAny(new[] { ',', ';' });
                            if (end > 0) candidate = candidate[..end].Trim();
                            model = candidate.Length <= 80 ? candidate : candidate[..80];
                        }
                        break;
                    }
                }

                // Fallback: extract serial from "SN:", "S/N:", "Serial:" patterns
                if (string.IsNullOrEmpty(serialNumber))
                {
                    var snMatch = System.Text.RegularExpressions.Regex.Match(sysDescr,
                        @"(?:SN|S/N|Serial)[\s:=]+([A-Z0-9\-]{4,})", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (snMatch.Success)
                        serialNumber = snMatch.Groups[1].Value;
                }
            }
        }

        // Ultimate fallback: try to extract model from sysDescr's first line using common printer patterns
        if (string.IsNullOrEmpty(model) && !string.IsNullOrEmpty(sysDescr))
        {
            var line = sysDescr.Split('\n', '\r')[0].Trim();
            // Match patterns like "XXXX-XXX-XXX" (model + serial), "ModelName Series" etc.
            var modelMatch = System.Text.RegularExpressions.Regex.Match(line,
                @"(?:model|type)[:\s]+([A-Za-z0-9\-\.\s]{3,40})", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (modelMatch.Success)
                model = modelMatch.Groups[1].Value.Trim();
            // If still empty and the first line starts with a well-known manufacturer prefix
            else if (string.IsNullOrEmpty(model))
            {
                var knownPrefixes = new[] { "ECOSYS", "TASKALFA", "FS-", "CS-", "LP-", "DP-", "KM-" };
                var prefixMatch = knownPrefixes.FirstOrDefault(p =>
                    line.IndexOf(p, StringComparison.OrdinalIgnoreCase) >= 0);
                if (prefixMatch != null)
                {
                    var idx = line.IndexOf(prefixMatch, StringComparison.OrdinalIgnoreCase);
                    var candidate = line.Substring(idx).Trim();
                    var end = candidate.IndexOfAny(new[] { ',', ';' });
                    if (end > 0) candidate = candidate[..end].Trim();
                    model = candidate.Length <= 80 ? candidate : candidate[..80];
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
                workingVersion, endpoint, communityOctet,
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
                workingVersion, endpoint, communityOctet,
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
                    workingVersion, endpoint, communityOctet,
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
        long monoPages = 0;
        long colorPages = 0;
        bool isColor = false;

        // Try vendor-specific OIDs based on detected manufacturer (prints + copies only)
        if (!string.IsNullOrEmpty(manufacturer))
        {
            if (manufacturer.IndexOf("Kyocera", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var result = await Messenger.GetAsync(
                        workingVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(KyoceraTotalPrints),
                            new Variable(KyoceraTotalCopies),
                            new Variable(KyoceraMonoPrints),
                            new Variable(KyoceraMonoCopies),
                            new Variable(KyoceraColorPrints),
                            new Variable(KyoceraColorCopies),
                        }, ct);

                    long printsTot = 0, copiesTot = 0;
                    long monoPrints = 0, monoCopies = 0;
                    long colorPrints = 0, colorCopies = 0;
                    foreach (var v in result)
                    {
                        if (v.Id == KyoceraTotalPrints && long.TryParse(v.Data?.ToString(), out var t))
                            printsTot = t;
                        else if (v.Id == KyoceraTotalCopies && long.TryParse(v.Data?.ToString(), out var c2))
                            copiesTot = c2;
                        else if (v.Id == KyoceraMonoPrints && long.TryParse(v.Data?.ToString(), out var m))
                            monoPrints = m;
                        else if (v.Id == KyoceraMonoCopies && long.TryParse(v.Data?.ToString(), out var mc))
                            monoCopies = mc;
                        else if (v.Id == KyoceraColorPrints && long.TryParse(v.Data?.ToString(), out var cp))
                            colorPrints = cp;
                        else if (v.Id == KyoceraColorCopies && long.TryParse(v.Data?.ToString(), out var cc))
                            colorCopies = cc;
                    }
                    totalPages = printsTot + copiesTot;
                    monoPages = monoPrints + monoCopies;
                    colorPages = colorPrints + colorCopies;
                    if (colorPages > 0) isColor = true;
                }
                catch { }

                // If kmCommon OIDs returned nothing, try alternative total OID (older models)
                if (totalPages == 0)
                {
                    try
                    {
                        var ct = new CancellationTokenSource(NormalTimeout).Token;
                        var altResult = await Messenger.GetAsync(
                            workingVersion, endpoint, communityOctet,
                            new List<Variable> { new Variable(KyoceraTotalAlt) }, ct);
                        if (long.TryParse(altResult?.FirstOrDefault()?.Data?.ToString(), out var tAlt))
                            totalPages = tAlt;
                    }
                    catch { }
                }
            }
            else if (manufacturer.IndexOf("Canon", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var result = await Messenger.GetAsync(
                        workingVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(CanonAltTotalPages),
                            new Variable(CanonMonoAlt),
                            new Variable(CanonColorAlt),
                            new Variable(PrtMarkerCounterUnitTotal),
                            new Variable(CanonMonoPages),
                            new Variable(CanonColorPages),
                        }, ct);

                    foreach (var v in result)
                    {
                        if (v.Id == CanonAltTotalPages && long.TryParse(v.Data?.ToString(), out var ta))
                        {
                            if (ta > 0) totalPages = ta;
                        }
                        else if (v.Id == PrtMarkerCounterUnitTotal && long.TryParse(v.Data?.ToString(), out var t))
                        {
                            if (totalPages == 0) totalPages = t;
                        }
                        else if (v.Id == CanonMonoAlt && long.TryParse(v.Data?.ToString(), out var ma))
                        {
                            if (ma > 0) monoPages = ma;
                        }
                        else if (v.Id == CanonMonoPages && long.TryParse(v.Data?.ToString(), out var m))
                        {
                            if (monoPages == 0) monoPages = m;
                        }
                        else if (v.Id == CanonColorAlt && long.TryParse(v.Data?.ToString(), out var ca))
                        {
                            if (ca > 0) { colorPages = ca; isColor = true; }
                        }
                        else if (v.Id == CanonColorPages && long.TryParse(v.Data?.ToString(), out var c))
                        {
                            if (colorPages == 0) { colorPages = c; if (c > 0) isColor = true; }
                        }
                    }
                }
                catch { }
            }
            else if (manufacturer.IndexOf("Epson", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var result = await Messenger.GetAsync(
                        workingVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(EpsonMonoAlt),
                            new Variable(EpsonColorAlt),
                            new Variable(PrtMarkerCounterUnitTotal),
                            new Variable(EpsonMonoPages),
                            new Variable(EpsonColorPages),
                        }, ct);

                    foreach (var v in result)
                    {
                        if (v.Id == EpsonMonoAlt && long.TryParse(v.Data?.ToString(), out var ma))
                        {
                            if (ma > 0) monoPages = ma;
                        }
                        else if (v.Id == EpsonMonoPages && long.TryParse(v.Data?.ToString(), out var m))
                        {
                            if (monoPages == 0) monoPages = m;
                        }
                        else if (v.Id == EpsonColorAlt && long.TryParse(v.Data?.ToString(), out var ca))
                        {
                            if (ca > 0) { colorPages = ca; isColor = true; }
                        }
                        else if (v.Id == EpsonColorPages && long.TryParse(v.Data?.ToString(), out var c))
                        {
                            if (colorPages == 0) { colorPages = c; if (c > 0) isColor = true; }
                        }
                        else if (v.Id == PrtMarkerCounterUnitTotal && long.TryParse(v.Data?.ToString(), out var t))
                            totalPages = t;
                    }
                    if (totalPages == 0 && monoPages > 0)
                        totalPages = monoPages + colorPages;
                }
                catch { }
            }
            else if (manufacturer.IndexOf("Brother", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var result = await Messenger.GetAsync(
                        workingVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(BrotherMonoPages),
                            new Variable(BrotherColorPages),
                            new Variable(BrotherTotalPages),
                        }, ct);

                    foreach (var v in result)
                    {
                        if (v.Id == BrotherMonoPages && long.TryParse(v.Data?.ToString(), out var m))
                            monoPages = m;
                        else if (v.Id == BrotherColorPages && long.TryParse(v.Data?.ToString(), out var c))
                        { colorPages = c; if (c > 0) isColor = true; }
                        else if (v.Id == BrotherTotalPages && long.TryParse(v.Data?.ToString(), out var t))
                            totalPages = t;
                    }
                    if (totalPages == 0 && monoPages > 0)
                        totalPages = monoPages + colorPages;
                }
                catch { }
            }
            else if (manufacturer.IndexOf("HP", StringComparison.OrdinalIgnoreCase) >= 0 ||
                     manufacturer.IndexOf("Hewlett", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var result = await Messenger.GetAsync(
                        workingVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(HpTotalPages),
                            new Variable(HpMonoPages),
                            new Variable(HpColorPages),
                        }, ct);

                    foreach (var v in result)
                    {
                        if (v.Id == HpTotalPages && long.TryParse(v.Data?.ToString(), out var t))
                            totalPages = t;
                        else if (v.Id == HpMonoPages && long.TryParse(v.Data?.ToString(), out var m))
                        { if (totalPages == 0) totalPages = m; }
                        else if (v.Id == HpColorPages && long.TryParse(v.Data?.ToString(), out var c))
                        { colorPages = c; if (c > 0) isColor = true; }
                    }
                }
                catch { }
            }
            else if (manufacturer.IndexOf("Oki", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var ct = new CancellationTokenSource(NormalTimeout).Token;
                    var result = await Messenger.GetAsync(
                        workingVersion, endpoint, communityOctet,
                        new List<Variable>
                        {
                            new Variable(OkiMonoPages),
                            new Variable(OkiColorPages),
                            new Variable(PrtMarkerCounterUnitTotal),
                            new Variable(PrtMarkerCounterUnitColor),
                        }, ct);

                    foreach (var v in result)
                    {
                        if (v.Id == OkiMonoPages && long.TryParse(v.Data?.ToString(), out var m))
                            monoPages = m;
                        else if (v.Id == OkiColorPages && long.TryParse(v.Data?.ToString(), out var c))
                        { colorPages = c; if (c > 0) isColor = true; }
                        else if (v.Id == PrtMarkerCounterUnitTotal && long.TryParse(v.Data?.ToString(), out var t))
                            totalPages = t;
                        else if (v.Id == PrtMarkerCounterUnitColor && long.TryParse(v.Data?.ToString(), out var co))
                            if (colorPages == 0 && co > 0) { colorPages = co; isColor = true; }
                    }
                    if (totalPages == 0 && monoPages > 0)
                        totalPages = monoPages + colorPages;
                }
                catch { }
            }
        }

        // Fall back to standard OID if vendor-specific didn't return a value
        if (totalPages == 0)
        {
            try
            {
                var ct = new CancellationTokenSource(NormalTimeout).Token;
                var counterResult = await Messenger.GetAsync(
                    workingVersion, endpoint, communityOctet,
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
                    { colorPages = c; if (c > 0) isColor = true; }
                }
            }
            catch { }
        }

        // Fall back to walking the marker table
        if (totalPages == 0)
        {
            try
            {
                var ct = new CancellationTokenSource(WalkTimeout).Token;
                var walkResults = new List<Variable>();
                await Messenger.WalkAsync(
                    workingVersion, endpoint, communityOctet,
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
                workingVersion, endpoint, communityOctet,
                PrtMarkerSuppliesTable, suppliesWalk, WalkMode.WithinSubtree, ct);
            ParseSupplyTable(suppliesWalk, supplies.Supplies, events, ip);
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

        // Clean up OKI serial: "OKI-ES4172LPMFP-E1358E" -> "E1358E"
        if (!string.IsNullOrEmpty(serialNumber) && serialNumber.Contains('-'))
        {
            var parts = serialNumber.Split('-');
            if (parts.Length >= 3 && !string.IsNullOrEmpty(manufacturer) &&
                parts[0].Equals(manufacturer, StringComparison.OrdinalIgnoreCase))
            {
                serialNumber = parts[^1];
            }
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
            MonoPages = monoPages > 0 ? monoPages : totalPages - colorPages,
            ColorPages = colorPages,
            CollectedAt = DateTime.UtcNow,
        };

        return (printer, counters, supplies, events);
    }

    private static void ParseSupplyTable(List<Variable> walkResults, List<SupplyItem> supplies, List<EventInfo> events, string printerIp)
    {
        var rows = new Dictionary<string, Dictionary<int, ISnmpData>>();

        foreach (var v in walkResults)
        {
            var nums = v.Id.ToNumerical();
            if (nums.Length < 12) continue;

            int column = (int)nums[10];

            // Build row key from remaining indices (compound key for multi-index tables)
            var rowKeyBuilder = new System.Text.StringBuilder();
            for (int i = 11; i < nums.Length; i++)
            {
                if (i > 11) rowKeyBuilder.Append('.');
                rowKeyBuilder.Append(nums[i]);
            }
            var rowKey = rowKeyBuilder.ToString();

            if (!rows.ContainsKey(rowKey))
                rows[rowKey] = new Dictionary<int, ISnmpData>();

            rows[rowKey][column] = v.Data;
        }

        foreach (var (rowIdx, cols) in rows)
        {
            int? supplyType = null;
            if (cols.TryGetValue(5, out var typeData) && typeData is Integer32 intVal)
                supplyType = intVal.ToInt32();

            if (supplyType == null || supplyType == 1 || supplyType == 2)
                continue;

            string? description = null;
            if (cols.TryGetValue(6, out var descData) && descData is OctetString descOctet)
                description = descOctet.ToString();

            int? maxCapacity = null;
            if (cols.TryGetValue(8, out var maxData))
            {
                if (maxData is Integer32 maxInt) maxCapacity = maxInt.ToInt32();
                else if (maxData is Gauge32 maxGauge) maxCapacity = (int)maxGauge.ToUInt32();
            }

            int? level = null;
            if (cols.TryGetValue(9, out var levelData))
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

            var (typeName, readableName) = MapSupplyType(supplyType.Value, description);

            if (typeName != "toner_black" && typeName != "toner_cyan" && typeName != "toner_magenta" &&
                typeName != "toner_yellow" && typeName != "drum" && typeName != "waste_toner" &&
                typeName != "fuser" && typeName != "transfer_roller" && typeName != "developer")
                continue;

            string status = "ok";
            if (levelPercent.HasValue)
            {
                if (levelPercent <= 5) status = "critical";
                else if (levelPercent <= 15) status = "low";
            }

            supplies.Add(new SupplyItem
            {
                Type = typeName,
                Name = readableName ?? description ?? $"Supply {rowIdx}",
                LevelPercent = Math.Clamp(levelPercent ?? 100, 0, 100),
                LevelRemaining = level,
                MaxCapacity = maxCapacity,
                Status = status,
            });

            if (status == "low" || status == "critical")
            {
                events.Add(new EventInfo
                {
                    PrinterIp = printerIp,
                    EventType = status == "critical" ? "toner_critical" : "toner_low",
                    Severity = status == "critical" ? "critical" : "warning",
                    Code = status == "critical" ? "TONER_CRITICAL" : "TONER_LOW",
                    Description = $"{readableName ?? description ?? typeName} at {levelPercent}%",
                    OccurredAt = DateTime.UtcNow,
                });
            }
        }
    }

    private static (string typeName, string? readableName) MapSupplyType(int supplyType, string? description)
    {
        // Map consumable supplies to toner_black/cyan/magenta/yellow
        if (supplyType is 3 or 5 or 6 or 18)
        {
            var desc = (description ?? "").ToLowerInvariant();
            if (desc.Contains("cyan")) return ("toner_cyan", description);
            if (desc.Contains("magenta")) return ("toner_magenta", description);
            if (desc.Contains("yellow")) return ("toner_yellow", description);
            return ("toner_black", description);
        }
        return supplyType switch
        {
            4 => ("waste_toner", description),
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
            19 => ("drum", description),
            20 => ("developer", description),
            _ => ($"supply_{supplyType}", description),
        };
    }

    private static bool IsInternalModelCode(string? model)
    {
        if (string.IsNullOrEmpty(model)) return false;
        // Internal codes are typically short alphanumeric like "AK88028918" (no spaces, 6-15 chars)
        return !model.Contains(' ') &&
               System.Text.RegularExpressions.Regex.IsMatch(model, @"^[A-Z0-9]{6,15}$");
    }
}
