namespace PrintMonitor.Agent.Models;

public class PrinterInfo
{
    public string IpAddress { get; set; } = string.Empty;
    public string? MacAddress { get; set; }
    public string? Hostname { get; set; }
    public string? Name { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public string? Location { get; set; }
    public string? FirmwareVersion { get; set; }
    public string Status { get; set; } = "unknown";
    public string? StatusDetail { get; set; }
    public long UptimeSeconds { get; set; }
    public bool IsMonochrome { get; set; }
}

public class CounterInfo
{
    public string PrinterIp { get; set; } = string.Empty;
    public long TotalPages { get; set; }
    public long? MonoPages { get; set; }
    public long? ColorPages { get; set; }
    public long? CopyPages { get; set; }
    public long? ScanPages { get; set; }
    public long? DuplexPages { get; set; }
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

public class SupplyInfo
{
    public string PrinterIp { get; set; } = string.Empty;
    public List<SupplyItem> Supplies { get; set; } = new();
}

public class SupplyItem
{
    public string Type { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int? LevelPercent { get; set; }
    public int? LevelRemaining { get; set; }
    public int? MaxCapacity { get; set; }
    public string Status { get; set; } = "unknown";
}

public class EventInfo
{
    public string PrinterIp { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Severity { get; set; } = "warning";
    public string? Code { get; set; }
    public string? Description { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}

public class JobInfo
{
    public string? JobId { get; set; }
    public string PrinterIp { get; set; } = string.Empty;
    public string? DocumentName { get; set; }
    public string? DocumentType { get; set; }
    public int? Pages { get; set; }
    public int Copies { get; set; } = 1;
    public int? ColorPages { get; set; }
    public int? MonoPages { get; set; }
    public bool? IsDuplex { get; set; }
    public string? Username { get; set; }
    public string? ComputerName { get; set; }
    public string? JobStatus { get; set; }
    public long? JobSizeBytes { get; set; }
    public DateTime? PrintedAt { get; set; }
}

public class SyncPayload
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public HeartbeatInfo? Heartbeat { get; set; }
    public List<PrinterInfo>? Printers { get; set; }
    public List<CounterInfo>? Counters { get; set; }
    public List<SupplyInfo>? Supplies { get; set; }
    public List<EventInfo>? Events { get; set; }
    public List<JobInfo>? Jobs { get; set; }
}

public class HeartbeatInfo
{
    public double CpuUsage { get; set; }
    public double MemoryUsage { get; set; }
    public long DiskFreeGb { get; set; }
}
