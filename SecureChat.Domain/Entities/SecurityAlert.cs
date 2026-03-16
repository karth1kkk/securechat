namespace SecureChat.Domain.Entities;

public class SecurityAlert
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string AlertType { get; set; } = default!;
    public string Description { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
    public bool Resolved { get; set; }

    public User User { get; set; } = default!;
}

