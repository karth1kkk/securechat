#include <stdint.h>
#include <string.h>

int32_t SystemNative_GetDomainName(char* buffer, int32_t bufferLength)
{
    const char* domain = "localdomain";
    size_t len = strlen(domain);
    if (bufferLength <= (int32_t)len)
    {
        return 1; // fail if buffer too small
    }
    memcpy(buffer, domain, len + 1);
    return 0;
}
