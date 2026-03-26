using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;
using SecureChatBackend.Hubs;

namespace SecureChatBackend.Application.Services;

public sealed class MessageService : IMessageService
{
    private readonly IMessageRepository _messageRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHubContext<MessagingHub, IMessagingClient> _hubContext;

    public MessageService(
        IMessageRepository messageRepository,
        IConversationRepository conversationRepository,
        IUnitOfWork unitOfWork,
        IHubContext<MessagingHub, IMessagingClient> hubContext)
    {
        _messageRepository = messageRepository;
        _conversationRepository = conversationRepository;
        _unitOfWork = unitOfWork;
        _hubContext = hubContext;
    }

    public async Task<MessageDto> SendMessageAsync(
        Guid conversationId,
        Guid senderId,
        string encryptedContent,
        string encryptedKey,
        string nonce,
        string tag,
        string? signature,
        DateTime? expiryTime,
        CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null || !conversation.Participants.Any(p => p.UserId == senderId && p.IsAccepted))
        {
            throw new InvalidOperationException("Sender is not a participant in the conversation.");
        }

        var message = new Message
        {
            ConversationId = conversationId,
            SenderId = senderId,
            EncryptedContent = encryptedContent,
            EncryptedKey = encryptedKey,
            Nonce = nonce,
            Tag = tag,
            Signature = signature,
            CreatedAt = DateTime.UtcNow,
            ExpiryTime = expiryTime
        };

        await _messageRepository.AddAsync(message, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new MessageDto(
            message.Id,
            message.ConversationId,
            message.SenderId,
            message.EncryptedContent,
            message.EncryptedKey,
            message.Nonce,
            message.Tag,
            message.Signature,
            message.CreatedAt,
            message.ExpiryTime);
        var groupName = MessagingHub.GetGroupName(conversationId);
        await _hubContext.Clients.Group(groupName).ReceiveEncryptedMessage(dto);
        return dto;
    }

    public async Task<IReadOnlyList<MessageDto>> GetMessagesAsync(Guid conversationId, Guid requesterId, int limit, DateTime? since, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null || !conversation.Participants.Any(p => p.UserId == requesterId && p.IsAccepted))
        {
            throw new InvalidOperationException("Requester is not a participant in the conversation.");
        }

        var messages = await _messageRepository.GetMessagesAsync(conversationId, limit, since, cancellationToken);
        return messages.Select(m => new MessageDto(
            m.Id,
            m.ConversationId,
            m.SenderId,
            m.EncryptedContent,
            m.EncryptedKey,
            m.Nonce,
            m.Tag,
            m.Signature,
            m.CreatedAt,
            m.ExpiryTime)).ToList();
    }
}
