using System.Threading;
using System.Threading.Tasks;

namespace SecureChatBackend.Application.Interfaces;

public interface IDeviceService
{
    Task TrackActivityAsync(Guid userId, string deviceName, CancellationToken cancellationToken = default);
}
