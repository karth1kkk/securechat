using System.Threading.Tasks;

namespace SecureChatBackend.Hubs;

public interface ICallClient
{
    Task ReceiveSignal(CallSignalDto signal);

    Task PeerJoined(string userId);
}
