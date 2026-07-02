using System.Diagnostics;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text.Json;

namespace PrintMonitor.Installer;

class Program
{
    const string ServiceName = "PrintMonitor Agent";
    const string TargetDir = @"C:\Program Files\PrintMonitor\Agent";
    static string? _serverUrl;
    static string? _activationCode;

    static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        ParseArgs(args);

        if (!IsAdministrator())
        {
            Console.WriteLine("Solicitando privilegios de administrador...");
            var psi = new ProcessStartInfo
            {
                FileName = Environment.ProcessPath!,
                Arguments = string.Join(" ", args.Select(a => a.Contains(' ') ? $"\"{a}\"" : a)),
                UseShellExecute = true,
                Verb = "runas",
            };
            try { Process.Start(psi); return 0; }
            catch { Console.WriteLine("ERRO: E necessario executar como administrador."); Console.ReadKey(); return 1; }
        }

        LoadConfig();

        Console.WriteLine("========================================");
        Console.WriteLine("  PrintMonitor Agent - Instalador");
        Console.WriteLine("========================================");
        Console.WriteLine();

        if (!ValidateConfig())
        {
            Console.WriteLine("Configuracao invalida. Corrija e tente novamente.");
            Console.ReadKey();
            return 1;
        }

        var sourceDir = AppContext.BaseDirectory;

        try
        {
            StopAndRemoveExistingService();
            CreateTargetDirectory();
            CopyFiles(sourceDir);
            WriteAppSettings();
            InstallService();
            StartService();

            Console.WriteLine();
            Console.WriteLine("========================================");
            Console.WriteLine("  INSTALACAO CONCLUIDA COM SUCESSO!");
            Console.WriteLine($"  Servico: {ServiceName}");
            Console.WriteLine($"  Pasta:   {TargetDir}");
            Console.WriteLine("========================================");
            Console.WriteLine();
            Console.WriteLine("O agente esta rodando em segundo plano.");
            Console.WriteLine("Feche esta janela para sair.");

            Task.Delay(3000).Wait();
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            Console.WriteLine($"ERRO: {ex.Message}");
            Console.WriteLine();
            Console.WriteLine("Pressione qualquer tecla para sair...");
            Console.ReadKey();
            return 1;
        }
    }

    static void ParseArgs(string[] args)
    {
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--url" && i + 1 < args.Length) _serverUrl = args[++i];
            else if (args[i] == "--code" && i + 1 < args.Length) _activationCode = args[++i];
        }
    }

    static void LoadConfig()
    {
        var configPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        if (!File.Exists(configPath)) return;

        try
        {
            var json = JsonDocument.Parse(File.ReadAllText(configPath));
            var agent = json.RootElement.GetProperty("Agent");
            if (_serverUrl == null && agent.TryGetProperty("ServerUrl", out var url))
                _serverUrl = url.GetString();
            if (_activationCode == null && agent.TryGetProperty("ActivationCode", out var code))
                _activationCode = code.GetString();
        }
        catch { }
    }

    static bool ValidateConfig()
    {
        if (string.IsNullOrWhiteSpace(_serverUrl))
        {
            Console.Write("URL do servidor: ");
            _serverUrl = Console.ReadLine()?.Trim();
        }
        else Console.WriteLine($"URL: {_serverUrl}");

        if (string.IsNullOrWhiteSpace(_activationCode))
        {
            Console.Write("Codigo de ativacao: ");
            _activationCode = Console.ReadLine()?.Trim();
        }
        else Console.WriteLine($"Codigo: {_activationCode}");

        return !string.IsNullOrWhiteSpace(_serverUrl) && !string.IsNullOrWhiteSpace(_activationCode);
    }

    static void StopAndRemoveExistingService()
    {
        var svc = ServiceController.GetServices().FirstOrDefault(s => s.ServiceName == ServiceName);
        if (svc == null) return;

        Console.Write($"[*] Removendo servico existente... ");
        try
        {
            if (svc.Status != ServiceControllerStatus.Stopped)
            {
                svc.Stop();
                svc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(15));
            }
            using var proc = Process.Start(new ProcessStartInfo("sc.exe", $"delete \"{ServiceName}\"")
            {
                CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true
            });
            proc?.WaitForExit(5000);
            Console.WriteLine("OK");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Aviso: {ex.Message}");
        }
    }

    static void CreateTargetDirectory()
    {
        Console.Write("[*] Criando pasta de instalacao... ");
        Directory.CreateDirectory(TargetDir);
        Console.WriteLine("OK");
    }

    static void CopyFiles(string sourceDir)
    {
        Console.Write("[*] Copiando arquivos... ");
        var exeName = Path.GetFileName(Environment.ProcessPath) ?? "PrintMonitor.Installer.exe";
        var batchName = "install.bat";

        foreach (var file in Directory.GetFiles(sourceDir))
        {
            var fileName = Path.GetFileName(file);
            if (fileName.Equals(exeName, StringComparison.OrdinalIgnoreCase)) continue;
            if (fileName.Equals(batchName, StringComparison.OrdinalIgnoreCase)) continue;

            File.Copy(file, Path.Combine(TargetDir, fileName), true);
        }

        Console.WriteLine("OK");
    }

    static void WriteAppSettings()
    {
        var targetConfig = Path.Combine(TargetDir, "appsettings.json");

        var appSettings = new
        {
            Agent = new
            {
                ServerUrl = _serverUrl,
                ActivationCode = _activationCode,
                CollectionIntervalSeconds = 300,
                HeartbeatIntervalSeconds = 60,
                JobCollectionIntervalSeconds = 120,
                DiscoveryIntervalSeconds = 600,
                SyncBatchMaxSize = 50,
                SyncBatchMaxBytes = 512000,
                MaxRetryBackoffSeconds = 300,
                LocalRetentionDays = 7,
                SnmpCommunity = "public",
                SnmpVersion = "v2c",
                SnmpTimeoutMs = 10000,
                SnmpRetries = 2,
                ScanNetworkRange = "",
            },
            Serilog = new { MinimumLevel = "Information" },
        };

        File.WriteAllText(targetConfig, JsonSerializer.Serialize(appSettings, new JsonSerializerOptions { WriteIndented = true }));
    }

    static void InstallService()
    {
        Console.Write("[*] Instalando servico Windows... ");
        var exePath = Path.Combine(TargetDir, "PrintMonitor.Agent.exe");

        var args = $"create \"{ServiceName}\" binPath= \"\\\"{exePath}\\\"\" start= auto";
        using var proc = Process.Start(new ProcessStartInfo("sc.exe", args)
        {
            CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true
        });
        var output = proc?.StandardOutput.ReadToEnd() ?? "";
        var err = proc?.StandardError.ReadToEnd() ?? "";
        proc?.WaitForExit(10000);

        if (proc?.ExitCode != 0 && !output.Contains("already exists"))
        {
            Console.WriteLine($"FALHA: {err}");
            return;
        }

        var descArgs = $"description \"{ServiceName}\" \"Servico de monitoramento de impressoras PrintMonitor\"";
        Process.Start(new ProcessStartInfo("sc.exe", descArgs) { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit(3000);

        var failureArgs = $"failure \"{ServiceName}\" reset= 86400 actions= restart/5000/restart/10000/restart/30000";
        Process.Start(new ProcessStartInfo("sc.exe", failureArgs) { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit(3000);

        Console.WriteLine("OK");
    }

    static void StartService()
    {
        Console.Write("[*] Iniciando servico... ");
        try
        {
            using var svc = new ServiceController(ServiceName);
            svc.Start();
            svc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
            Console.WriteLine("OK");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Aviso: {ex.Message}");
        }
    }

    static bool IsAdministrator()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            using var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            return new System.Security.Principal.WindowsPrincipal(identity)
                .IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
        }
        return true;
    }
}
