using System;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface IDeviceRepository
{
    Task<Device?> GetByUserIdAndNameAsync(Guid userId, string deviceName, CancellationToken cancellationToken = default);
    Task AddAsync(Device device, CancellationToken cancellationToken = default);
    void Update(Device device);
}
