using Microsoft.Extensions.Logging;

namespace PrintMonitor.Agent.Services;

public class HeartbeatService
{
    private readonly TokenManager _tokenManager;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<HeartbeatService> _logger;

    public HeartbeatService(
        TokenManager tokenManager,
        IHttpClientFactory httpClientFactory,
        ILogger<HeartbeatService> logger)
    {
        _tokenManager = tokenManager;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendAsync(CancellationToken ct)
    {
        if (!_tokenManager.IsAuthenticated) return;

        try
        {
            var client = _httpClientFactory.CreateClient("AgentApi");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tokenManager.AgentToken);

            var response = await client.PostAsync($"/agents/{_tokenManager.AgentId}/heartbeat", null, ct);
            response.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Heartbeat failed");
        }
    }
}
