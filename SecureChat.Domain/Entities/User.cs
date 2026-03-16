namespace SecureChat.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string PublicKey { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLogin { get; set; }

    public ICollection<DeviceSession> DeviceSessions { get; set; } = new List<DeviceSession>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<SecurityAlert> SecurityAlerts { get; set; } = new List<SecurityAlert>();
}

