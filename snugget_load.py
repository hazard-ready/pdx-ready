import os
import csv
import psycopg2

from django.contrib.contenttypes.models import ContentType
from disasterinfosite.models import *

currentPath = os.path.dirname(__file__)
appName = "disasterinfosite"
appDir = os.path.join(currentPath, "disasterinfosite")
dataDir = os.path.join(appDir, "data")
snuggetFile = os.path.join(dataDir, "snuggets.csv")

requiredFields = ['shapefile', 'section', 'subsection']
# all other fields in snuggetFile are required. The empty string is to deal with Excel's charming habit of putting a blank column after all data in a CSV.
optionalFields = ['heading', 'intensity', 'image', 'lookup_value', 'txt_location', 'pop_out_image', 'pop_out_link','pop_alt_txt', 'pop_out_txt', 'intensity_txt', 'text', '']

def run():
  overwriteAll = False
  try:
    dbURL = os.environ['DATABASE_URL']
  except:
    print("Error: DATABASE_URL environment variable is not set. See README.md for how to set it.")
    exit()

# dbURL should be in the form protocol://user:password@host:port/databasename
  dbParts = [x.split('/') for x in dbURL.split('@')]
  dbHost = dbParts[1][0].split(":")[0]
  dbPort = dbParts[1][0].split(":")[1]
  dbUser = dbParts[0][2].split(":")[0]
  dbPass = dbParts[0][2].split(":")[1]
  dbName = dbParts[1][1]

  with psycopg2.connect(host=dbHost, port=dbPort, user=dbUser, password=dbPass, database=dbName) as conn:
    with conn.cursor() as cur:
      with open(snuggetFile) as csvFile:
        newSnuggets = csv.DictReader(csvFile)
        rowCount = 1 # row 1 consists of field names, so row 2 is the first data row. We'll increment this before first referencing it.
        for row in newSnuggets:
          rowCount += 1
          if allRequiredFieldsPresent(row, rowCount):
            overwriteAll = processRow(cur, row, overwriteAll)
  print("Snugget load complete. Processed", rowCount, "rows in", snuggetFile)


def allRequiredFieldsPresent(row, rowCount):
  if any(a != '' for a in row.values()): # if the entire row is not empty
    blanks = []
    for key in row.keys():
      if (key not in optionalFields) and (row[key] == ''):
        blanks.append(key)
    if blanks == []:
      return True
    else:
      print("Unable to process row", rowCount, "with content:")
      print(row)
      if len(blanks) > 1:
        print("Because required fields", blanks, "are empty.")
      else:
        print("Because required field", "'" + blanks[0] + "'", "is empty.")
      return False
  else: # the entire row is blank
    print("Skipping empty row", rowCount)
    return False




def processRow(cur, row, overwriteAll):
  filterColumn = row["shapefile"] + "_filter"
  section, created = SnuggetSection.objects.get_or_create(name=row["section"])

  if created:
    print("Created a new snugget section: ", row["section"])

  # check if a snugget for this data already exists
  # if we have a lookup value then deal with this value specifically:
  if row["lookup_value"] is not '':  # if it is blank, we'll treat it as matching all existing values
    filterID = row["lookup_value"]
    oldSnugget = checkForSnugget(row, section, filterColumn, filterID)
    overwriteAll = askUserAboutOverwriting(row, oldSnugget, [], snuggetFile, overwriteAll)
    removeOldSnugget(row, section, filterColumn, filterID)
    addTextSnugget(row, section, filterColumn, filterID)
    return overwriteAll
  else:
    filterIDs = findAllFilterIDs(row["shapefile"], cur)
    oldSnuggets = []
    for filterID in filterIDs:
      if filterID is None:
        print("Skipping row:")
        print(row)
        print("Because no filter for lookup_value", row["lookup_value"], "was found in", row["shapefile"])
        return overwriteAll
      else:
        oldSnugget = checkForSnugget(row, sectionID, filterColumn, filterID)
        if oldSnugget is not None and oldSnugget not in oldSnuggets:
          oldSnuggets.append(oldSnugget)
      overwriteAll = askUserAboutOverwriting(row, None, oldSnuggets, snuggetFile, overwriteAll)
      removeOldSnugget(row, section, filterColumn, filterID)
      addTextSnugget(row, section, filterColumn, filterID)

    return overwriteAll

def getShapefileClass(row):
  modelName = row["shapefile"].lower()
  if ContentType.objects.filter(app_label=appName, model=modelName).exists():
    shapefile = ContentType.objects.get(app_label=appName, model=modelName).model_class()
    return shapefile
  else:  # this means that nothing was found in the database for the shapefile name we read from snuggetFile
    print("No shapefile with the name", row["shapefile"], "appears to have been loaded.")
    print("If the shapefile exists, you may still need to run the migration and loading steps - see the 'Load some data' section of the readme file.")
    return None

def getShapefileFilter(shapefile, filterVal):
  # The lookup value / filter field is the one from the shapefile that is not one of these.
  field = next(f for f in shapefile._meta.get_fields() if f.name not in ['id', 'geom', 'group'])
  kwargs = {field.name: filterVal}
  if shapefile.objects.filter(**kwargs).exists()
    return shapefile.objects.get(**kwargs)
  else:
    print("Could not find a filter field for", shapefile)
    return None


def addTextSnugget(row, section, filterColumn, filterVal):
#   "intensity" -> disasterinfosite_textsnugget.percentage (numeric, null as null)
#   "text" -> disasterinfosite_textsnugget.content
#   "heading" -> disasterinfosite_textsnugget.display_name
  if row["intensity"] == '':
    row["intensity"] = None
  shapefile = getShapefileClass(row)
  group = shapefile.getGroup()
  shapefileFilter = getShapefileFilter(shapefile, filterVal)

  kwargs = {
  'section': section,
  'group': group,
  filterColumn: shapefileFilter,
  'content': row["text"],
  'percentage': row["intensity"],
  }
  print('creating snugget with:', kwargs)
  snugget = TextSnugget.objects.create(**kwargs)


def findAllFilterIDs(shapefile, cur):
  ids = []
  cur.execute("SELECT id FROM " + appName + "_" + shapefile + ";")
  for row in cur.fetchall():
    ids.extend(row)
  return ids


def checkForSnugget(row, section, filterColumn, filterVal):
  shapefile = getShapefileClass(row)
  kwargs = {'section': section.id, filterColumn: getShapefileFilter(shapefile, filterVal)}
  if Snugget.objects.filter(**kwargs).exists():
    return Snugget.objects.get(**kwargs)
  else:
    return None


def removeOldSnugget(row, section, filterColumn, filterVal):
  shapefile = getShapefileClass(row)
  kwargs = {'section': section.id, filterColumn: getShapefileFilter(shapefile, filterVal)}
  Snugget.objects.filter(**kwargs).delete()


# Check with the user about overwriting existing snuggets, giving them the options to:
# either quit and check what's going on, or say "yes to all" and not get prompted again.
def askUserAboutOverwriting(row, oldSnugget, oldSnuggets, snuggetFile, overwriteAll):
  if overwriteAll: # if it's already set, then don't do anything else
    return True
  else:
    print(oldSnuggets)
    if oldSnugget is not None:
      print("In shapefile ", repr(row["shapefile"]), " there is already a snugget defined for section " , repr(row["section"]), ", intensity ", repr(row["lookup_value"]), " with the following text content:", sep="")
      print(oldSnugget)
    elif oldSnuggets != []:
      print("In shapefile ", repr(row["shapefile"]), " there are existing snuggets for section" , repr(row["section"]), " with the following text content:", sep="")
      for snugget in oldSnuggets:
        print(snugget)
    else:
      # if no existing snuggets were found, then we neither need to ask the user this time nor change overwriteAll
      return overwriteAll

    print("Please enter one of the following letters to choose how to proceed:")
    print("R: Replace the existing snugget[s] with the new value loaded from", snuggetFile, " and ask again for the next one.")
    print("A: replace All without asking again.")
    print("Q: quit so you can edit", snuggetFile, "and/or check the snuggets in the Django admin panel and try again.")
    response = ""
    while response not in ["A", "R", "Q"]:
      response = input(">> ").upper()

    if response == "Q":
      exit(0)
    elif response == "A":
      return True
    elif response == "R":
      return False



if __name__ == "__main__":
  main()
