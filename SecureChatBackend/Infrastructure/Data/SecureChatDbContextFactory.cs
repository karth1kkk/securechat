using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace SecureChatBackend.Infrastructure.Data;

/// <summary>
/// Used by <c>dotnet ef</c> so migrations run against Postgres from env/config without executing
/// <see cref="Program"/> (which may fall back to in-memory DB and break <c>IMigrator</c>).
/// </summary>
public sealed class SecureChatDbContextFactory : IDesignTimeDbContextFactory<SecureChatDbContext>
{
    public SecureChatDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "No DefaultConnection. Set ConnectionStrings__DefaultConnection (e.g. Host=127.0.0.1;Port=15432;... for an SSH tunnel to RDS), then run dotnet ef from the SecureChatBackend folder.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<SecureChatDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        return new SecureChatDbContext(optionsBuilder.Options);
    }
}
