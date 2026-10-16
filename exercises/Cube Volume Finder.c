[[#]]include [[<]]stdio.h[[>]]

int [[main]]() 
{
    int side, vol;
	
    printf("Side: ");
    scanf("%d", &[[side]]);
    
    vol = side * side * side[[;]]
    printf("Volume: %d", vol)[[;]]
    
    [[return]] 0;
}