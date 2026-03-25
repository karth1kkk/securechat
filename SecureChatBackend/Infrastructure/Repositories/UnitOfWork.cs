using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Infrastructure.Data;

namespace SecureChatBackend.Infrastructure.Repositories;

public sealed class UnitOfWork : IUnitOfWork
{
    private readonly SecureChatDbContext _context;

    public UnitOfWork(SecureChatDbContext context)
    {
        _context = context;
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }
}
