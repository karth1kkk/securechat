using System;
using System.Collections.Generic;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class CreateConversationInput
{
    public IEnumerable<Guid> ParticipantIds { get; set; } = Array.Empty<Guid>();
    public bool IsGroup { get; set; }
}
