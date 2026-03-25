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
        var participantDtos = new List<ParticipantDto>();

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
                Conversation = conversation
            });

            participantDtos.Add(new ParticipantDto(user.Id, user.PublicKey));
        }

        await _conversationRepository.AddAsync(conversation, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new ConversationDto(conversation.Id, conversation.IsGroup, conversation.CreatedAt, participantDtos);
    }

    public async Task<bool> IsParticipantAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null)
        {
            return false;
        }

        return conversation.Participants.Any(p => p.UserId == userId);
    }
}
