using Microsoft.EntityFrameworkCore;
using SecureChat.Domain.Entities;

namespace SecureChat.Infrastructure.Persistence;

public class SecureChatDbContext : DbContext
{
    public SecureChatDbContext(DbContextOptions<SecureChatDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<DeviceSession> DeviceSessions => Set<DeviceSession>();
    public DbSet<SecurityAlert> SecurityAlerts => Set<SecurityAlert>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(u => u.Id);
            b.HasIndex(u => u.Username).IsUnique();
            b.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<Message>(b =>
        {
            b.HasKey(m => m.Id);
            b.HasOne(m => m.Sender)
                .WithMany(u => u.Messages)
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId);
        });

        modelBuilder.Entity<DeviceSession>(b =>
        {
            b.HasKey(d => d.Id);
            b.HasOne(d => d.User)
                .WithMany(u => u.DeviceSessions)
                .HasForeignKey(d => d.UserId);
        });

        modelBuilder.Entity<SecurityAlert>(b =>
        {
            b.HasKey(s => s.Id);
            b.HasOne(s => s.User)
                .WithMany(u => u.SecurityAlerts)
                .HasForeignKey(s => s.UserId);
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasKey(r => r.Id);
            b.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId);
            b.HasIndex(r => r.Token).IsUnique();
        });
    }
}

