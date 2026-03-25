using System.Threading.Tasks;
using SecureChatBackend.Application.Services;

namespace SecureChatBackend.Hubs;

public interface IMessagingClient
{
    Task ReceiveEncryptedMessage(MessageDto message);
}
