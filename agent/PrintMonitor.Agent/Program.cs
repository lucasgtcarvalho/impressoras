using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using PrintMonitor.Agent.Services;
using PrintMonitor.Agent.Collectors;
using PrintMonitor.Agent.Sync;
using PrintMonitor.Agent.Storage;
using PrintMonitor.Agent;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/agent-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    var host = Host.CreateDefaultBuilder(args)
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

    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Agent terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
