using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Services;

namespace SecureChatBackend.Application.Interfaces;

public interface IMessageService
{
    Task<MessageDto> SendMessageAsync(
        Guid conversationId,
        Guid senderId,
        string encryptedContent,
        string encryptedKey,
        string nonce,
        string tag,
        string? signature,
        DateTime? expiryTime,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MessageDto>> GetMessagesAsync(Guid conversationId, Guid requesterId, int limit, DateTime? since, CancellationToken cancellationToken = default);
}
