using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;

namespace PrintMonitor.Agent.Storage;

public class PrinterCacheEntry
{
    public string Ip { get; set; } = string.Empty;
    public string? Mac { get; set; }
    public string? Hostname { get; set; }
    public string? Name { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Serial { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime LastSeen { get; set; }
}

public class PendingSyncItem
{
    public long Id { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public int RetryCount { get; set; }
    public string? LastError { get; set; }

    public object? GetPayload()
    {
        try { return JsonSerializer.Deserialize<object>(Payload); }
        catch { return null; }
    }
}

public class LocalDatabase
{
    private readonly string _connectionString;
    private readonly ILogger<LocalDatabase> _logger;

    public LocalDatabase(ILogger<LocalDatabase> logger)
    {
        _logger = logger;
        var dataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
        Directory.CreateDirectory(dataDir);
        var dbPath = Path.Combine(dataDir, "agent.db");
        _connectionString = $"Data Source={dbPath}";
        Initialize();
    }

    private void Initialize()
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS discovered_printers (
                ip TEXT PRIMARY KEY,
                mac TEXT,
                hostname TEXT,
                name TEXT,
                manufacturer TEXT,
                model TEXT,
                serial TEXT,
                is_active INTEGER DEFAULT 1,
                last_seen TEXT
            );
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                last_error TEXT,
                next_retry_at TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_type TEXT NOT NULL,
                status TEXT NOT NULL,
                items_count INTEGER DEFAULT 0,
                error_message TEXT,
                synced_at TEXT DEFAULT (datetime('now'))
            );
        ";
        cmd.ExecuteNonQuery();
    }

    public async Task<List<PrinterCacheEntry>> GetActivePrintersAsync()
    {
        var printers = new List<PrinterCacheEntry>();
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM discovered_printers WHERE is_active = 1";

        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            printers.Add(new PrinterCacheEntry
            {
                Ip = reader.GetString(0),
                Mac = reader.IsDBNull(1) ? null : reader.GetString(1),
                Hostname = reader.IsDBNull(2) ? null : reader.GetString(2),
                Name = reader.IsDBNull(3) ? null : reader.GetString(3),
                Manufacturer = reader.IsDBNull(4) ? null : reader.GetString(4),
                Model = reader.IsDBNull(5) ? null : reader.GetString(5),
                Serial = reader.IsDBNull(6) ? null : reader.GetString(6),
                IsActive = reader.GetInt32(7) == 1,
            });
        }

        return printers;
    }

    public async Task SaveDiscoveredPrinterAsync(PrinterCacheEntry entry)
    {
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT OR REPLACE INTO discovered_printers (ip, mac, last_seen, is_active)
            VALUES (@ip, @mac, @lastSeen, 1)";
        cmd.Parameters.AddWithValue("@ip", entry.Ip);
        cmd.Parameters.AddWithValue("@mac", (object?)entry.Mac ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@lastSeen", entry.LastSeen.ToString("O"));

        await cmd.ExecuteNonQueryAsync();
    }

    public void UpdatePrinterCache(string ip, Models.PrinterInfo printer)
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT OR REPLACE INTO discovered_printers 
            (ip, hostname, name, manufacturer, model, serial, last_seen, is_active)
            VALUES (@ip, @hostname, @name, @manufacturer, @model, @serial, @lastSeen, 1)";
        cmd.Parameters.AddWithValue("@ip", ip);
        cmd.Parameters.AddWithValue("@hostname", (object?)printer.Hostname ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@name", (object?)printer.Name ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@manufacturer", (object?)printer.Manufacturer ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@model", (object?)printer.Model ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@serial", (object?)printer.SerialNumber ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@lastSeen", DateTime.UtcNow.ToString("O"));

        cmd.ExecuteNonQuery();
    }

    public async Task EnqueueSyncAsync<T>(string endpoint, T data)
    {
        var payload = JsonSerializer.Serialize(data);
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO sync_queue (endpoint, payload, status, created_at)
            VALUES (@endpoint, @payload, 'pending', datetime('now'))";
        cmd.Parameters.AddWithValue("@endpoint", endpoint);
        cmd.Parameters.AddWithValue("@payload", payload);

        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<PendingSyncItem>> GetPendingSyncItemsAsync(int maxItems)
    {
        var items = new List<PendingSyncItem>();
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT id, endpoint, payload, retry_count, last_error
            FROM sync_queue
            WHERE status = 'pending'
            ORDER BY id ASC
            LIMIT @max";
        cmd.Parameters.AddWithValue("@max", maxItems);

        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            items.Add(new PendingSyncItem
            {
                Id = reader.GetInt64(0),
                Endpoint = reader.GetString(1),
                Payload = reader.GetString(2),
                RetryCount = reader.GetInt32(3),
                LastError = reader.IsDBNull(4) ? null : reader.GetString(4),
            });
        }

        return items;
    }

    public async Task MarkSyncItemSentAsync(long id)
    {
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM sync_queue WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task MarkSyncItemFailedAsync(long id)
    {
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE sync_queue 
            SET retry_count = retry_count + 1, last_error = @error
            WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@error", $"Failed at {DateTime.UtcNow:O}");
        await cmd.ExecuteNonQueryAsync();
    }
}
