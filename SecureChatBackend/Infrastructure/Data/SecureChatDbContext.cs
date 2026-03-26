using System;
using Microsoft.EntityFrameworkCore;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Infrastructure.Data;

public sealed class SecureChatDbContext : DbContext
{
    public SecureChatDbContext(DbContextOptions<SecureChatDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<ConversationParticipant> ConversationParticipants => Set<ConversationParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.SessionId).IsUnique();
            // Public keys are stable per-device identity; use them for idempotent registration.
            entity.HasIndex(x => x.PublicKey);
            entity.Property(x => x.SessionId).IsRequired().HasMaxLength(66);
            entity.Property(x => x.PublicKey).IsRequired();
            entity.Property(x => x.CreatedAt).IsRequired();
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DeviceName).IsRequired();
            entity.Property(x => x.LastActive).IsRequired();
            entity.HasOne(x => x.User).WithMany(x => x.Devices).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.Property(x => x.IsGroup).IsRequired();
        });

        modelBuilder.Entity<ConversationParticipant>(entity =>
        {
            entity.HasKey(x => new { x.ConversationId, x.UserId });
            entity.HasOne(x => x.Conversation).WithMany(x => x.Participants).HasForeignKey(x => x.ConversationId);
            entity.HasOne(x => x.User).WithMany(x => x.ConversationParticipants).HasForeignKey(x => x.UserId);
            entity.Property(x => x.IsAccepted).IsRequired();
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.EncryptedContent).IsRequired();
            entity.Property(x => x.EncryptedKey).IsRequired();
            entity.Property(x => x.Nonce).IsRequired().HasMaxLength(24);
            entity.Property(x => x.Tag).IsRequired().HasMaxLength(24);
            entity.Property(x => x.Signature).HasMaxLength(512);
            entity.Property(x => x.CreatedAt).IsRequired();
            entity.HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationId);
            entity.HasOne(x => x.Sender).WithMany().HasForeignKey(x => x.SenderId);
        });
    }
}
