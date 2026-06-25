using System.Net;
using System.Net.NetworkInformation;
using Microsoft.Extensions.Logging;
using PrintMonitor.Agent.Storage;

namespace PrintMonitor.Agent.Services;

public class NetworkDiscoveryService
{
    private readonly LocalDatabase _db;
    private readonly ILogger<NetworkDiscoveryService> _logger;
    private readonly ConfigManager _config;

    public NetworkDiscoveryService(
        LocalDatabase db,
        ILogger<NetworkDiscoveryService> logger,
        ConfigManager config)
    {
        _db = db;
        _logger = logger;
        _config = config;
    }

    public async Task DiscoverAsync(CancellationToken ct)
    {
        _logger.LogInformation("Starting network discovery");

        var discovered = new List<(string Ip, string Mac)>();

        // Ping sweep on local subnet
        var localIp = GetLocalIpAddress();
        var subnet = GetSubnet(localIp);

        if (subnet != null)
        {
            _logger.LogInformation("Scanning subnet {Subnet}", subnet);
            var tasks = new List<Task>();
            for (int i = 1; i < 255; i++)
            {
                var ip = $"{subnet}.{i}";
                tasks.Add(PingAndDiscoverAsync(ip, discovered, ct));
            }
            await Task.WhenAll(tasks);
        }

        // Also try configured ranges
        if (!string.IsNullOrEmpty(_config.ScanNetworkRange))
        {
            // Parse and scan custom range
        }

        _logger.LogInformation("Discovery complete. Found {Count} devices", discovered.Count);
    }

    private async Task PingAndDiscoverAsync(string ip, List<(string, string)> results, CancellationToken ct)
    {
        try
        {
            using var ping = new Ping();
            var reply = await ping.SendPingAsync(ip, 1000);
            if (reply.Status == IPStatus.Success)
            {
                var mac = GetMacAddress(ip);
                results.Add((ip, mac));

                await _db.SaveDiscoveredPrinterAsync(new Storage.PrinterCacheEntry
                {
                    Ip = ip,
                    Mac = mac,
                    LastSeen = DateTime.UtcNow,
                    IsActive = true
                });
            }
        }
        catch
        {
            // Ignore unreachable hosts
        }
    }

    private static string GetLocalIpAddress()
    {
        var host = Dns.GetHostEntry(Dns.GetHostName());
        return host.AddressList
            .FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork
                && !IPAddress.IsLoopback(a))
            ?.ToString() ?? "192.168.1.1";
    }

    private static string? GetSubnet(string ip)
    {
        var parts = ip.Split('.');
        if (parts.Length == 4)
            return $"{parts[0]}.{parts[1]}.{parts[2]}";
        return null;
    }

    private static string GetMacAddress(string ip)
    {
        try
        {
            var arpStream = ExecuteArpCommand();
            foreach (var line in arpStream.Split('\n'))
            {
                if (line.Contains(ip))
                {
                    var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2)
                        return parts[1].Replace('-', ':');
                }
            }
        }
        catch { }
        return "";
    }

    private static string ExecuteArpCommand()
    {
        using var process = new System.Diagnostics.Process
        {
            StartInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "arp",
                Arguments = "-a",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };
        process.Start();
        return process.StandardOutput.ReadToEnd();
    }
}
