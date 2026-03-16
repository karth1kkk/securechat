using HotChocolate.Types;
using SecureChat.Domain.Entities;

namespace SecureChat.Application.GraphQL;

public class UserType : ObjectType<User> { }
public class ConversationType : ObjectType<Conversation> { }
public class MessageType : ObjectType<Message> { }
public class SecurityAlertType : ObjectType<SecurityAlert> { }

