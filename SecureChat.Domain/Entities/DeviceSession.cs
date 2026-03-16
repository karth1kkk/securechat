namespace SecureChat.Domain.Entities;

public class DeviceSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string DeviceName { get; set; } = default!;
    public string IPAddress { get; set; } = default!;
    public string LoginLocation { get; set; } = default!;
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = default!;
}

