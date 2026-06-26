using System.Diagnostics;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using PrintMonitor.Agent.Models;
using PrintMonitor.Agent.Storage;
using PrintMonitor.Agent.Services;

namespace PrintMonitor.Agent.Collectors;

public class JobCollectorService
{
    private readonly LocalDatabase _db;
    private readonly ILogger<JobCollectorService> _logger;

    public JobCollectorService(
        LocalDatabase db,
        ILogger<JobCollectorService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task CollectAsync(CancellationToken ct)
    {
        _logger.LogInformation("Collecting print jobs");

        try
        {
            // Method 1: Windows Event Log (Microsoft-Windows-PrintService/Operational)
            var eventLogJobs = CollectFromEventLog();

            // Method 2: WMI Win32_PrintJob
            var wmiJobs = CollectFromWmi();

            var allJobs = eventLogJobs.Concat(wmiJobs)
                .GroupBy(j => new { j.JobId, j.PrinterIp })
                .Select(g => g.First())
                .ToList();

            if (allJobs.Count > 0)
            {
                await _db.EnqueueSyncAsync("jobs", allJobs);
                _logger.LogInformation("Collected {Count} print jobs", allJobs.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to collect print jobs");
        }
    }

    private List<JobInfo> CollectFromEventLog()
    {
        var jobs = new List<JobInfo>();

        try
        {
            var eventLogName = "Microsoft-Windows-PrintService/Operational";
            var query = $"*[System[EventID=307]]";

            using var reader = new System.Diagnostics.Eventing.Reader.EventLogReader(
                new System.Diagnostics.Eventing.Reader.EventLogQuery(
                    eventLogName,
                    System.Diagnostics.Eventing.Reader.PathType.LogName,
                    query)
                { ReverseDirection = true });

            System.Diagnostics.Eventing.Reader.EventRecord? eventRecord;
            int count = 0;

            while ((eventRecord = reader.ReadEvent()) != null && count < 100)
            {
                try
                {
                    var xml = eventRecord.ToXml();
                    var doc = XDocument.Parse(xml);
                    var data = doc.Descendants("Data").ToList();

                    var job = new JobInfo
                    {
                        JobId = GetEventData(data, "JobId"),
                        DocumentName = GetEventData(data, "DocumentName"),
                        Username = CleanUsername(GetEventData(data, "UserName")),
                        ComputerName = GetEventData(data, "ComputerName"),
                        PrinterIp = GetEventData(data, "PrinterName") ?? "unknown",
                        Pages = int.TryParse(GetEventData(data, "Pages"), out var p) ? p : null,
                        JobSizeBytes = long.TryParse(GetEventData(data, "Size"), out var s) ? s : null,
                        JobStatus = "completed",
                        PrintedAt = eventRecord.TimeCreated?.ToUniversalTime(),
                    };

                    jobs.Add(job);
                    count++;
                }
                catch { }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Event Log reading failed");
        }

        return jobs;
    }

    private List<JobInfo> CollectFromWmi()
    {
        var jobs = new List<JobInfo>();

        try
        {
            using var searcher = new System.Management.ManagementObjectSearcher(
                "SELECT * FROM Win32_PrintJob");
            foreach (var obj in searcher.Get())
            {
                try
                {
                    var name = obj["Name"]?.ToString() ?? "";
                    var parts = name.Split(',');
                    var printerName = parts.Length > 0 ? parts[0].Trim() : "";

                    var job = new JobInfo
                    {
                        JobId = obj["JobId"]?.ToString(),
                        DocumentName = obj["Document"]?.ToString(),
                        Username = CleanUsername(obj["Owner"]?.ToString()),
                        PrinterIp = printerName,
                        Pages = int.TryParse(obj["TotalPages"]?.ToString(), out var p) ? p : null,
                        Copies = int.TryParse(obj["Copies"]?.ToString(), out var c) ? c : 1,
                        JobStatus = obj["Status"]?.ToString()?.ToLower(),
                        PrintedAt = DateTime.UtcNow,
                    };

                    jobs.Add(job);
                }
                catch { }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WMI query failed");
        }

        return jobs;
    }

    private static string? GetEventData(List<XElement> data, string name)
    {
        return data.FirstOrDefault(e => e.Attribute("Name")?.Value == name)?.Value;
    }

    private static string? CleanUsername(string? username)
    {
        if (string.IsNullOrEmpty(username)) return "unknown";
        if (username.Contains('\\'))
            return username.Split('\\')[1];
        return username;
    }
}
