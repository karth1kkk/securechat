using System;

namespace SecureChatBackend.Domain.Entities;

public sealed class Device
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string DeviceName { get; set; } = null!;
    public DateTime LastActive { get; set; } = DateTime.UtcNow;
}
