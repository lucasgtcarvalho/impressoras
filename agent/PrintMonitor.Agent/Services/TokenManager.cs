using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace PrintMonitor.Agent.Services;

public class TokenManager
{
    private readonly ConfigManager _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TokenManager> _logger;

    public TokenManager(
        ConfigManager config,
        IHttpClientFactory httpClientFactory,
        ILogger<TokenManager> logger)
    {
        _config = config;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public string? AgentId { get; private set; }
    public string? AgentToken { get; private set; }
    public bool IsAuthenticated => !string.IsNullOrEmpty(AgentToken);

    public async Task InitializeAsync(CancellationToken ct)
    {
        var savedToken = await LoadTokenAsync();
        if (!string.IsNullOrEmpty(savedToken))
        {
            AgentToken = savedToken;
            return;
        }

        if (string.IsNullOrEmpty(_config.ActivationCode))
        {
            _logger.LogWarning("No activation code configured");
            return;
        }

        await ActivateAsync(ct);
    }

    private async Task ActivateAsync(CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("AgentApi");
            var response = await client.PostAsJsonAsync("/agents/activate", new
            {
                activationCode = _config.ActivationCode,
                hostname = Environment.MachineName,
                osInfo = Environment.OSVersion.ToString(),
                localIp = GetLocalIp(),
                version = "1.0.0"
            }, ct);

            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<ActivateResponse>(ct);
            if (result != null)
            {
                AgentId = result.AgentId;
                AgentToken = result.AgentToken;
                await SaveTokenAsync(result.AgentToken);
                _logger.LogInformation("Agent activated: {AgentId}", AgentId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to activate agent");
        }
    }

    private static string GetLocalIp()
    {
        var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
        return host.AddressList
            .FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            ?.ToString() ?? "127.0.0.1";
    }

    private async Task<string?> LoadTokenAsync()
    {
        try
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent.token");
            if (File.Exists(path))
                return await File.ReadAllTextAsync(path);
        }
        catch { }
        return null;
    }

    private async Task SaveTokenAsync(string token)
    {
        try
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent.token");
            await File.WriteAllTextAsync(path, token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save token");
        }
    }

    private class ActivateResponse
    {
        [JsonPropertyName("agentId")]
        public string AgentId { get; set; } = string.Empty;

        [JsonPropertyName("agentToken")]
        public string AgentToken { get; set; } = string.Empty;
    }
}
