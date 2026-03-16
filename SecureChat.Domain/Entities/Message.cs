namespace SecureChat.Domain.Entities;

public class Message
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public Guid ConversationId { get; set; }
    public string EncryptedContent { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
    public bool IsDeleted { get; set; }

    public User Sender { get; set; } = default!;
    public Conversation Conversation { get; set; } = default!;
}

