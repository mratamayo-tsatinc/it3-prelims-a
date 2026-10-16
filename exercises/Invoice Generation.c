#include <stdio.h>

int main() {
    char name[] [[=]] "John Doe";
    int id [[=]] 12345;
    float amount [[=]] 99.99;

    [[printf]]("Invoice for Customer: %s\nOrder ID: %d\nTotal Amount: $%.2f", name, id, amount);

    return [[0]];
}