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
        var token = _tokenService.GenerateToken(user);

        return new SessionRegistrationResult(user.Id, user.SessionId, user.PublicKey, token);
    }

    public Task<User?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        return _userRepository.GetBySessionIdAsync(sessionId, cancellationToken);
    }
}
