using System.Net.Http.Json;
using System.Text.Json;
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
        var saved = await LoadTokenAsync();
        if (saved != null)
        {
            AgentId = saved.AgentId;
            AgentToken = saved.AgentToken;

            if (saved.IsLegacy)
                await SaveTokenAsync(AgentToken);

            _logger.LogInformation("Token loaded for agent: {AgentId}", AgentId);
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
            var response = await client.PostAsJsonAsync("agents/activate", new
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

    private static string GetTokenPath()
    {
        return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent.token");
    }

    private async Task<TokenData?> LoadTokenAsync()
    {
        try
        {
            var path = GetTokenPath();
            if (!File.Exists(path)) return null;
            var json = await File.ReadAllTextAsync(path);
            if (json.TrimStart().StartsWith("{"))
                return System.Text.Json.JsonSerializer.Deserialize<TokenData>(json);

            var parts = json.Split('.');
            if (parts.Length == 3)
            {
                var payload = parts[1];
                payload = payload.Replace('-', '+').Replace('_', '/');
                switch (payload.Length % 4)
                {
                    case 2: payload += "=="; break;
                    case 3: payload += "="; break;
                }
                var bytes = Convert.FromBase64String(payload);
                var decoded = System.Text.Encoding.UTF8.GetString(bytes);
                using var doc = JsonDocument.Parse(decoded);
                var agentId = doc.RootElement.TryGetProperty("sub", out var sub) ? sub.GetString() : null;
                return new TokenData { AgentId = agentId, AgentToken = json, IsLegacy = true };
            }
            return new TokenData { AgentId = null, AgentToken = json, IsLegacy = true };
        }
        catch { }
        return null;
    }

    private async Task SaveTokenAsync(string token)
    {
        try
        {
            var path = GetTokenPath();
            var data = new TokenData { AgentId = AgentId, AgentToken = token };
            var json = System.Text.Json.JsonSerializer.Serialize(data);
            await File.WriteAllTextAsync(path, json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save token");
        }
    }

    private class TokenData
    {
        [JsonPropertyName("agentId")]
        public string? AgentId { get; set; }

        [JsonPropertyName("agentToken")]
        public string AgentToken { get; set; } = string.Empty;

        [JsonIgnore]
        public bool IsLegacy { get; set; }
    }

    private class ActivateResponse
    {
        [JsonPropertyName("agentId")]
        public string AgentId { get; set; } = string.Empty;

        [JsonPropertyName("agentToken")]
        public string AgentToken { get; set; } = string.Empty;
    }
}
