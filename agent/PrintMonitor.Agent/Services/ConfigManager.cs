using Microsoft.Extensions.Configuration;

namespace PrintMonitor.Agent.Services;

public class ConfigManager
{
    private readonly IConfiguration _config;

    public ConfigManager(IConfiguration config)
    {
        _config = config;
    }

    public string ServerUrl => _config["Agent:ServerUrl"] ?? "http://localhost:3000/api/v1";
    public string ActivationCode => _config["Agent:ActivationCode"] ?? "";
    public int CollectionIntervalSeconds => int.Parse(_config["Agent:CollectionIntervalSeconds"] ?? "300");
    public int HeartbeatIntervalSeconds => int.Parse(_config["Agent:HeartbeatIntervalSeconds"] ?? "60");
    public int JobCollectionIntervalSeconds => int.Parse(_config["Agent:JobCollectionIntervalSeconds"] ?? "120");
    public int DiscoveryIntervalSeconds => int.Parse(_config["Agent:DiscoveryIntervalSeconds"] ?? "600");
    public int SyncBatchMaxSize => int.Parse(_config["Agent:SyncBatchMaxSize"] ?? "50");
    public int SyncBatchMaxBytes => int.Parse(_config["Agent:SyncBatchMaxBytes"] ?? "512000");
    public int MaxRetryBackoffSeconds => int.Parse(_config["Agent:MaxRetryBackoffSeconds"] ?? "300");
    public int LocalRetentionDays => int.Parse(_config["Agent:LocalRetentionDays"] ?? "7");
    public string SnmpCommunity => _config["Agent:SnmpCommunity"] ?? "public";
    public string SnmpVersion => _config["Agent:SnmpVersion"] ?? "v2c";
    public int SnmpTimeoutMs => int.Parse(_config["Agent:SnmpTimeoutMs"] ?? "10000");
    public int SnmpRetries => int.Parse(_config["Agent:SnmpRetries"] ?? "2");
    public string ScanNetworkRange => _config["Agent:ScanNetworkRange"] ?? "";
}
