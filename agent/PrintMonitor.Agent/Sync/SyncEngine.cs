using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using PrintMonitor.Agent.Services;
using PrintMonitor.Agent.Storage;

namespace PrintMonitor.Agent.Sync;

public class SyncEngine
{
    private readonly TokenManager _tokenManager;
    private readonly LocalDatabase _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SyncEngine> _logger;
    private readonly ConfigManager _config;

    public SyncEngine(
        TokenManager tokenManager,
        LocalDatabase db,
        IHttpClientFactory httpClientFactory,
        ILogger<SyncEngine> logger,
        ConfigManager config)
    {
        _tokenManager = tokenManager;
        _db = db;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _config = config;
    }

    public async Task SyncAsync(CancellationToken ct)
    {
        if (!_tokenManager.IsAuthenticated) return;

        var pendingItems = await _db.GetPendingSyncItemsAsync(_config.SyncBatchMaxSize);
        if (pendingItems.Count == 0) return;

        _logger.LogInformation("Syncing {Count} items", pendingItems.Count);

        foreach (var item in pendingItems)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var client = _httpClientFactory.CreateClient("AgentApi");
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tokenManager.AgentToken);

                // Build payload for this batch
                var payload = new
                {
                    timestamp = DateTime.UtcNow,
                    heartbeat = (object?)null,
                    printers = item.Endpoint == "printers" ? item.GetPayload() : null,
                    counters = item.Endpoint == "counters" ? item.GetPayload() : null,
                    supplies = item.Endpoint == "supplies" ? item.GetPayload() : null,
                    events = item.Endpoint == "events" ? item.GetPayload() : null,
                    jobs = item.Endpoint == "jobs" ? item.GetPayload() : null,
                };

                var response = await client.PostAsJsonAsync(
                    $"agents/{_tokenManager.AgentId}/sync",
                    payload, ct);

                if (response.IsSuccessStatusCode)
                {
                    await _db.MarkSyncItemSentAsync(item.Id);
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    _logger.LogWarning("Rate limited. Waiting before next sync");
                    await Task.Delay(5000, ct);
                    break;
                }
                else
                {
                    _logger.LogWarning("Sync failed with status {StatusCode}", response.StatusCode);
                    await _db.MarkSyncItemFailedAsync(item.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Sync failed");
                await _db.MarkSyncItemFailedAsync(item.Id);
            }
        }
    }
}
