using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;
using SecureChatBackend.Infrastructure.Data;

namespace SecureChatBackend.Infrastructure.Repositories;

public sealed class DeviceRepository : IDeviceRepository
{
    private readonly SecureChatDbContext _context;

    public DeviceRepository(SecureChatDbContext context)
    {
        _context = context;
    }

    public Task<Device?> GetByUserIdAndNameAsync(Guid userId, string deviceName, CancellationToken cancellationToken = default)
    {
        return _context.Devices.FirstOrDefaultAsync(d => d.UserId == userId && d.DeviceName == deviceName, cancellationToken);
    }

    public Task AddAsync(Device device, CancellationToken cancellationToken = default)
    {
        return _context.Devices.AddAsync(device, cancellationToken).AsTask();
    }

    public void Update(Device device)
    {
        _context.Devices.Update(device);
    }
}
