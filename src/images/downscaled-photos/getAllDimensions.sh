#!/usr/bin/env bash

# This file is for generating the dimensions for the downscaled photos to be used for react-photo-album

# ** Update SEARCH_DIR and directory for replacing SEARCH_DIR with AWS URL

echo "Generating json..."

SEARCH_DIR=/portfolio-landing-page/src/images/downscaled-photos
OUTPUT_JSON=$SEARCH_DIR/output.json

rm $OUTPUT_JSON
touch $OUTPUT_JSON
echo "[ " >> $OUTPUT_JSON

for entry in "$SEARCH_DIR"/*
do
    if [[ $entry == *".jpeg" ]];
    then
        DIMENSIONS=$(identify -format '"width": "%w", "height": "%h" },' $entry)
        RESULT="{ \"src\": \"$entry\", "
        RESULT+=$DIMENSIONS
        echo $RESULT >> $OUTPUT_JSON
    fi
done

# remove the last comma in the list
if [ -n "$(tail -c1 $OUTPUT_JSON)" ]  # if the file doesnt have a trailing new line.
then
    truncate -s-1 $OUTPUT_JSON        # remove one char
else
    truncate -s-2 $OUTPUT_JSON        # remove the last two characters
fi

# close the array
echo -e "\n]" >> $OUTPUT_JSON

# make sure to escape forward slashes with backslashes
sed -i 's/\(DIRECTORY\)/$BUCKET_NAME/g' $OUTPUT_JSON
