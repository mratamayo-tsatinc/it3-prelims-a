#include <stdio.h>

int [[main]]() 
[[{]]
    int hours = 40[[;]]
    float rate = 15.50;
    float total;
    
    total [[=]] hours * rate;
    printf("Pay: $%.2f", total);
    
    return 0;
[[}]]