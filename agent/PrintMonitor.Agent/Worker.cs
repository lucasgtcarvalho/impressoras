using PrintMonitor.Agent.Services;
using PrintMonitor.Agent.Collectors;
using PrintMonitor.Agent.Sync;

namespace PrintMonitor.Agent;

public class Worker : BackgroundService
{
    private readonly ConfigManager _config;
    private readonly TokenManager _tokenManager;
    private readonly NetworkDiscoveryService _discovery;
    private readonly SnmpCollectorService _snmpCollector;
    private readonly JobCollectorService _jobCollector;
    private readonly SyncEngine _syncEngine;
    private readonly HeartbeatService _heartbeat;
    private readonly ILogger<Worker> _logger;

    public Worker(
        ConfigManager config,
        TokenManager tokenManager,
        NetworkDiscoveryService discovery,
        SnmpCollectorService snmpCollector,
        JobCollectorService jobCollector,
        SyncEngine syncEngine,
        HeartbeatService heartbeat,
        ILogger<Worker> logger)
    {
        _config = config;
        _tokenManager = tokenManager;
        _discovery = discovery;
        _snmpCollector = snmpCollector;
        _jobCollector = jobCollector;
        _syncEngine = syncEngine;
        _heartbeat = heartbeat;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PrintMonitor Agent starting");

        await _tokenManager.InitializeAsync(stoppingToken);
        if (!_tokenManager.IsAuthenticated)
        {
            _logger.LogError("Agent not activated. Set ActivationCode in config.");
            return;
        }

        var discoveryTimer = new PeriodicTimer(
            TimeSpan.FromSeconds(_config.DiscoveryIntervalSeconds));
        var collectTimer = new PeriodicTimer(
            TimeSpan.FromSeconds(_config.CollectionIntervalSeconds));
        var jobTimer = new PeriodicTimer(
            TimeSpan.FromSeconds(_config.JobCollectionIntervalSeconds));
        var syncTimer = new PeriodicTimer(
            TimeSpan.FromSeconds(30));
        var heartbeatTimer = new PeriodicTimer(
            TimeSpan.FromSeconds(_config.HeartbeatIntervalSeconds));

        // Initial discovery
        await _discovery.DiscoverAsync(stoppingToken);

        var tasks = new[]
        {
            RunTimer(discoveryTimer, _discovery.DiscoverAsync, stoppingToken),
            RunTimer(collectTimer, _snmpCollector.CollectAsync, stoppingToken),
            RunTimer(jobTimer, _jobCollector.CollectAsync, stoppingToken),
            RunTimer(syncTimer, _syncEngine.SyncAsync, stoppingToken),
            RunTimer(heartbeatTimer, _heartbeat.SendAsync, stoppingToken),
        };

        await Task.WhenAll(tasks);
    }

    private async Task RunTimer(
        PeriodicTimer timer,
        Func<CancellationToken, Task> operation,
        CancellationToken ct)
    {
        try
        {
            while (await timer.WaitForNextTickAsync(ct))
            {
                await operation(ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Graceful shutdown
        }
    }
}
