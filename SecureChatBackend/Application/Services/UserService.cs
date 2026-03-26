using System;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Services;

public sealed class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IDeviceRepository _deviceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ISessionIdGenerator _sessionIdGenerator;
    private readonly ITokenService _tokenService;

    public UserService(
        IUserRepository userRepository,
        IDeviceRepository deviceRepository,
        IUnitOfWork unitOfWork,
        ISessionIdGenerator sessionIdGenerator,
        ITokenService tokenService)
    {
        _userRepository = userRepository;
        _deviceRepository = deviceRepository;
        _unitOfWork = unitOfWork;
        _sessionIdGenerator = sessionIdGenerator;
        _tokenService = tokenService;
    }

    public async Task<SessionRegistrationResult> RegisterAnonymousAsync(string publicKey, string deviceName, CancellationToken cancellationToken = default)
    {
        // Identity stability across key rotation:
        // - We treat `deviceName` as the stable device identity (per local installation).
        // - If the same device re-registers with a new public key, we update the user record
        //   (sessionId/userId stay the same).

        // 1) Fast path: deviceName already registered -> update user public key
        var existingDevice = await _deviceRepository.GetByDeviceNameAsync(deviceName, cancellationToken);
        if (existingDevice != null && existingDevice.User != null)
        {
            existingDevice.User.PublicKey = publicKey;
            existingDevice.LastActive = DateTime.UtcNow;

            _userRepository.Update(existingDevice.User);
            _deviceRepository.Update(existingDevice);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            var token = _tokenService.GenerateToken(existingDevice.User);
            return new SessionRegistrationResult(existingDevice.User.Id, existingDevice.User.SessionId, existingDevice.User.PublicKey, token);
        }

        // 2) Compatibility path: same public key -> reuse stable user/sessionId
        var existingUser = await _userRepository.GetByPublicKeyAsync(publicKey, cancellationToken);
        if (existingUser != null)
        {
            var existingDeviceForUser = await _deviceRepository.GetByUserIdAndNameAsync(existingUser.Id, deviceName, cancellationToken);
            if (existingDeviceForUser == null)
            {
                await _deviceRepository.AddAsync(new Device
                {
                    UserId = existingUser.Id,
                    DeviceName = deviceName,
                    LastActive = DateTime.UtcNow
                }, cancellationToken);
            }
            else
            {
                existingDeviceForUser.LastActive = DateTime.UtcNow;
                _deviceRepository.Update(existingDeviceForUser);
            }

            // Ensure stored public key matches this registration.
            existingUser.PublicKey = publicKey;
            _userRepository.Update(existingUser);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            var token = _tokenService.GenerateToken(existingUser);
            return new SessionRegistrationResult(existingUser.Id, existingUser.SessionId, existingUser.PublicKey, token);
        }

        // 3) New device/user
        var sessionId = _sessionIdGenerator.GenerateSessionId();
        var user = new User
        {
            SessionId = sessionId,
            PublicKey = publicKey,
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user, cancellationToken);
        var device = new Device
        {
            UserId = user.Id,
            DeviceName = deviceName,
            LastActive = DateTime.UtcNow
        };

        await _deviceRepository.AddAsync(device, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        var newToken = _tokenService.GenerateToken(user);

        return new SessionRegistrationResult(user.Id, user.SessionId, user.PublicKey, newToken);
    }

    public Task<User?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        return _userRepository.GetBySessionIdAsync(sessionId, cancellationToken);
    }
}
