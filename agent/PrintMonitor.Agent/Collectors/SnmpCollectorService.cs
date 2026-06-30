using Microsoft.Extensions.Logging;
using PrintMonitor.Agent.Models;
using PrintMonitor.Agent.Storage;
using PrintMonitor.Agent.Services;

namespace PrintMonitor.Agent.Collectors;

public class SnmpCollectorService
{
    private readonly LocalDatabase _db;
    private readonly ConfigManager _config;
    private readonly ILogger<SnmpCollectorService> _logger;

    public SnmpCollectorService(
        LocalDatabase db,
        ConfigManager config,
        ILogger<SnmpCollectorService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task CollectAsync(CancellationToken ct)
    {
        var printers = await _db.GetActivePrintersAsync();
        _logger.LogInformation("Collecting SNMP data from {Count} printers", printers.Count);

        var printersData = new List<PrinterInfo>();
        var countersData = new List<CounterInfo>();
        var suppliesData = new List<SupplyInfo>();
        var eventsData = new List<EventInfo>();

        foreach (var printer in printers)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var (printerInfo, counters, supplies, events) = await SnmpScanner.ScanAsync(
                    printer.Ip,
                    _config.SnmpCommunity,
                    _config.SnmpVersion,
                    _config.SnmpTimeoutMs,
                    _config.SnmpRetries);

                if (printerInfo != null)
                {
                    printersData.Add(printerInfo);
                    _db.UpdatePrinterCache(printer.Ip, printerInfo);
                }
                else
                {
                    printersData.Add(new PrinterInfo { IpAddress = printer.Ip, Status = "offline" });
                    await _db.MarkPrinterInactiveAsync(printer.Ip);
                }

                if (counters != null) countersData.Add(counters);
                if (supplies != null) suppliesData.Add(supplies);
                if (events != null) eventsData.AddRange(events);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SNMP collection failed for {Ip}", printer.Ip);
                printersData.Add(new PrinterInfo { IpAddress = printer.Ip, Status = "offline" });
                await _db.MarkPrinterInactiveAsync(printer.Ip);
                eventsData.Add(new EventInfo
                {
                    PrinterIp = printer.Ip,
                    EventType = "offline",
                    Severity = "warning",
                    Description = $"SNMP communication failed: {ex.Message}",
                    OccurredAt = DateTime.UtcNow
                });
            }
        }

        // Enqueue for sync
        if (printersData.Count > 0)
            await _db.EnqueueSyncAsync("printers", printersData);
        if (countersData.Count > 0)
            await _db.EnqueueSyncAsync("counters", countersData);
        if (suppliesData.Count > 0)
            await _db.EnqueueSyncAsync("supplies", suppliesData);
        if (eventsData.Count > 0)
            await _db.EnqueueSyncAsync("events", eventsData);

        _logger.LogInformation(
            "Collected: {P} printers, {C} counters, {S} supplies, {E} events",
            printersData.Count, countersData.Count, suppliesData.Count, eventsData.Count);
    }
}
