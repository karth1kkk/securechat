#include <stdio.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>

int main(void) {
    char buf[256] = {0};
    int rc = getdomainname(buf, sizeof(buf));
    printf("rc=%d errno=%d (%s)\n", rc, errno, strerror(errno));
    if (rc == 0) {
        printf("domain=%s\n", buf);
    }
    return 0;
}
