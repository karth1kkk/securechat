using System;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Services;

public sealed class DeviceService : IDeviceService
{
    private readonly IDeviceRepository _deviceRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeviceService(IDeviceRepository deviceRepository, IUnitOfWork unitOfWork)
    {
        _deviceRepository = deviceRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task TrackActivityAsync(Guid userId, string deviceName, CancellationToken cancellationToken = default)
    {
        var device = await _deviceRepository.GetByUserIdAndNameAsync(userId, deviceName, cancellationToken);
        if (device == null)
        {
            device = new Device
            {
                UserId = userId,
                DeviceName = deviceName,
                LastActive = DateTime.UtcNow
            };

            await _deviceRepository.AddAsync(device, cancellationToken);
        }
        else
        {
            device.LastActive = DateTime.UtcNow;
            _deviceRepository.Update(device);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
