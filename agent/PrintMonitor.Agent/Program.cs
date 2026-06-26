using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using PrintMonitor.Agent.Services;
using PrintMonitor.Agent.Collectors;
using PrintMonitor.Agent.Sync;
using PrintMonitor.Agent.Storage;
using PrintMonitor.Agent;

var baseDir = Path.GetDirectoryName(typeof(Program).Assembly.Location)!;

try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "agent-debug.txt"), $"START baseDir={baseDir} args={string.Join(",", args)}\n"); } catch { }

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(baseDir, "logs", "agent-.log"), rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "agent-debug.txt"), "BEFORE HOST BUILD\n"); } catch { }
    var host = Host.CreateDefaultBuilder(args)
        .UseContentRoot(baseDir)
        .UseWindowsService(options =>
        {
            options.ServiceName = "PrintMonitor Agent";
        })
        .UseSerilog()
        .ConfigureServices((context, services) =>
        {
            services.AddSingleton<ConfigManager>();
            services.AddSingleton<TokenManager>();
            services.AddSingleton<LocalDatabase>();
            services.AddSingleton<NetworkDiscoveryService>();
            services.AddSingleton<SnmpCollectorService>();
            services.AddSingleton<JobCollectorService>();
            services.AddSingleton<SyncEngine>();
            services.AddSingleton<HeartbeatService>();

            services.AddHttpClient("AgentApi")
                .ConfigureHttpClient((sp, client) =>
                {
                    var config = sp.GetRequiredService<ConfigManager>();
                    var url = config.ServerUrl.TrimEnd('/') + '/';
                    client.BaseAddress = new Uri(url);
                    client.Timeout = TimeSpan.FromSeconds(30);
                });

            services.AddHostedService<Worker>();
        })
        .Build();

    try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "agent-debug.txt"), $"BUILD OK\n"); } catch { }

    await host.RunAsync();

    try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "agent-debug.txt"), $"RUN COMPLETED\n"); } catch { }
}
catch (Exception ex)
{
    Log.Fatal(ex, "Agent terminated unexpectedly");
    try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "agent-debug.txt"), $"FATAL: {ex}\n"); } catch { }
}
finally
{
    Log.CloseAndFlush();
}
