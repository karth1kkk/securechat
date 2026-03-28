using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Services;

public sealed class ConversationService : IConversationService
{
    private readonly IConversationRepository _conversationRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;

    public ConversationService(
        IConversationRepository conversationRepository,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork)
    {
        _conversationRepository = conversationRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<ConversationDto> CreateConversationAsync(IEnumerable<Guid> participantIds, bool isGroup, CancellationToken cancellationToken = default)
    {
        var uniqueParticipantIds = participantIds.Distinct().ToList();
        if (uniqueParticipantIds.Count < 2)
        {
            throw new InvalidOperationException("A conversation requires at least two participants.");
        }

        var conversation = new Conversation { IsGroup = isGroup };

        foreach (var participantId in uniqueParticipantIds)
        {
            var user = await _userRepository.GetByIdAsync(participantId, cancellationToken);
            if (user == null)
            {
                throw new InvalidOperationException("Participant not found.");
            }

            conversation.Participants.Add(new ConversationParticipant
            {
                UserId = user.Id,
                Conversation = conversation,
                IsAccepted = true
            });
        }

        await _conversationRepository.AddAsync(conversation, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _conversationRepository.GetByIdAsync(conversation.Id, cancellationToken);
        return saved is null ? throw new InvalidOperationException("Conversation could not be loaded.") : BuildDto(saved);
    }

    public async Task<ConversationDto> CreateConversationRequestAsync(Guid requesterId, Guid targetId, CancellationToken cancellationToken = default)
    {
        if (requesterId == targetId)
        {
            throw new InvalidOperationException("You cannot request a chat with yourself.");
        }

        var requester = await _userRepository.GetByIdAsync(requesterId, cancellationToken);
        var target = await _userRepository.GetByIdAsync(targetId, cancellationToken);
        if (requester == null || target == null)
        {
            throw new InvalidOperationException("Requester/target not found.");
        }

        var conversation = new Conversation { IsGroup = false };

        // Requester is accepted immediately; target becomes accepted once they approve the request.
        conversation.Participants.Add(new ConversationParticipant
        {
            UserId = requester.Id,
            Conversation = conversation,
            IsAccepted = true
        });
        conversation.Participants.Add(new ConversationParticipant
        {
            UserId = target.Id,
            Conversation = conversation,
            IsAccepted = false
        });

        await _conversationRepository.AddAsync(conversation, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _conversationRepository.GetByIdAsync(conversation.Id, cancellationToken);
        return saved is null ? throw new InvalidOperationException("Conversation could not be loaded.") : BuildDto(saved);
    }

    public async Task<bool> IsParticipantAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null)
        {
            return false;
        }

        return conversation.Participants.Any(p => p.UserId == userId && p.IsAccepted);
    }

    public async Task<IReadOnlyList<ConversationDto>> GetConversationsAsync(Guid userId, bool isAccepted, CancellationToken cancellationToken = default)
    {
        var conversations = await _conversationRepository.GetByUserAsync(userId, isAccepted, cancellationToken);

        // Map entity -> DTO
        return conversations.Select(BuildDto).ToList();
    }

    public async Task AcceptConversationRequestAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null)
        {
            throw new InvalidOperationException("Conversation not found.");
        }

        var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant == null)
        {
            throw new InvalidOperationException("Request not addressed to this user.");
        }

        participant.IsAccepted = true;
        // Repository doesn't expose Update; rely on DbContext tracking via GetByIdAsync Include.
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task DeclineConversationRequestAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null)
        {
            return;
        }

        var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant == null)
        {
            throw new InvalidOperationException("Request not addressed to this user.");
        }

        // Simplest behavior: declining removes the entire pending conversation request.
        await _conversationRepository.DeleteAsync(conversationId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<ConversationDto> CreateOrGetDirectConversationAsync(Guid requesterId, string targetSessionId, CancellationToken cancellationToken = default)
    {
        var target = await _userRepository.GetBySessionIdAsync(targetSessionId, cancellationToken);
        if (target == null)
        {
            throw new InvalidOperationException("Target user not found.");
        }

        if (target.Id == requesterId)
        {
            throw new InvalidOperationException("Cannot start a chat with yourself.");
        }

        var existing = await _conversationRepository.GetBetweenUsersAsync(requesterId, target.Id, requireAccepted: true, cancellationToken);
        if (existing != null)
        {
            return BuildDto(existing);
        }

        return await CreateConversationAsync(new[] { target.Id, requesterId }, false, cancellationToken);
    }

    public async Task DeleteConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null)
        {
            throw new InvalidOperationException("Conversation not found.");
        }

        if (!conversation.Participants.Any(p => p.UserId == userId && p.IsAccepted))
        {
            throw new InvalidOperationException("Only participants can delete a conversation.");
        }

        await _conversationRepository.DeleteAsync(conversationId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<ConversationDto> CreateConversationRequestWithSessionIdAsync(Guid requesterId, string targetSessionId, CancellationToken cancellationToken = default)
    {
        var target = await _userRepository.GetBySessionIdAsync(targetSessionId, cancellationToken);
        if (target == null)
        {
            throw new InvalidOperationException("Target user not found.");
        }

        return await CreateConversationRequestAsync(requesterId, target.Id, cancellationToken);
    }

    private static ConversationDto BuildDto(Conversation conversation)
    {
        var participantDtos = conversation.Participants
            .Select(p => new ParticipantDto(p.UserId, p.User.PublicKey, p.User.SessionId, p.User.Username))
            .ToList();
        return new ConversationDto(conversation.Id, conversation.IsGroup, conversation.CreatedAt, conversation.LastMessageAt, participantDtos);
    }
}
