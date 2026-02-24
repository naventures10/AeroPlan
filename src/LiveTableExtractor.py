import requests
from bs4 import BeautifulSoup



class TableParser:
    """The Ultimate Translator: Bulletproof against missing tbodys, ins/del wrappers, and H6 tags."""
    def __init__(self):
        self.text_delimiter = " | "

    def clean_cell_text(self, cell_soup):
        # By using get_text with a separator, BeautifulSoup automatically handles 
        # <p>, <h6>, <br>, and any other tags perfectly without us needing to hunt for them.
        return cell_soup.get_text(separator=self.text_delimiter, strip=True)

    def get_direct_rows(self, table_soup):
        """
        ULTRA-SAFE ROW FINDER: Bypasses <tbody>, <ins>, <del> wrappers, 
        but stops at nested tables to prevent infinite loops.
        """
        rows = []
        for child in table_soup.descendants:
            if child.name == 'tr':
                # Ensure we only grab rows belonging to THIS table, not a nested one
                parent_table = child.find_parent('table')
                if parent_table == table_soup:
                    rows.append(child)
        return rows

    def build_virtual_grid(self, table_soup):
        filled_cells = {}
        max_y = 0
        max_x = 0

        # Use the new ultra-safe row finder
        rows = self.get_direct_rows(table_soup)
        
        if not rows:
            return []
        
        for y, row in enumerate(rows):
            x = 0
            
            # Use the same safe extraction for cells to bypass internal row wrappers
            cells = []
            for child in row.descendants:
                if child.name in ['td', 'th']:
                    parent_row = child.find_parent('tr')
                    if parent_row == row:
                        cells.append(child)
            
            for cell in cells:
                while (y, x) in filled_cells:
                    x += 1
                
                rowspan = int(cell.get('rowspan', 1))
                colspan = int(cell.get('colspan', 1))
                cell_text = self.clean_cell_text(cell)
                
                for i in range(rowspan):
                    for j in range(colspan):
                        filled_cells[(y + i, x + j)] = cell_text
                        max_y = max(max_y, y + i)
                        max_x = max(max_x, x + j)
                
                x += colspan

        virtual_grid = []
        for y in range(max_y + 1):
            row_data = []
            for x in range(max_x + 1):
                row_data.append(filled_cells.get((y, x), ""))
            virtual_grid.append(row_data)
            
        return virtual_grid

class LiveTableExtractor:
    """The Navigator: Finds sections and stitches split tables together or stacks them sequentially."""
    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.parser = TableParser() 

    def extract_section(self, url, section_id, mode="grid"):
        print(f"\n[*] Fetching target URL: {url} for section {section_id}")
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[!] Failed to fetch {url}: {e}")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        tables = soup.find_all('table')
        
        target_index = -1
        
        def get_primary_row_count(tbl):
            return len([tr for tr in tbl.find_all('tr') if tr.find_parent('table') == tbl])
        
        # 1. Anchor
        for i, table in enumerate(tables):
            table_text = table.get_text(separator=' ', strip=True)
            if section_id in table_text and get_primary_row_count(table) == 1:
                target_index = i
                print(f"[DEBUG] Found Anchor for {section_id} at Table Index {i}")
                break
                
        if target_index == -1:
            print(f"[-] Could not find anchor for section {section_id}.")
            return None

        # 2. Collect
        data_grids = []
        for j in range(target_index + 1, len(tables)):
            current_table = tables[j]
            text = current_table.get_text(separator=' ', strip=True)
            row_count = get_primary_row_count(current_table)
            
            print(f"\n[DEBUG] --- Scanning Table {j} ---")
            print(f"[DEBUG] Rows: {row_count}")
            print(f"[DEBUG] Text Preview: {text[:80]}...")
            
            # Boundary limit
            if row_count == 1 and ("AD 2." in text or "AD 3." in text):
                print(f"[DEBUG] !!! HIT BOUNDARY !!! Stopped collecting at Table {j}.")
                break
                
            grid_fragment = self.parser.build_virtual_grid(current_table)
            print(f"[DEBUG] Parser built a grid with {len(grid_fragment)} rows.")
            
            if grid_fragment:
                data_grids.append(grid_fragment)
            else:
                print(f"[DEBUG] WARNING: grid_fragment was empty and dropped!")

        if not data_grids:
            return None

        # 3. Assemble
        print(f"\n[DEBUG] Assembling {len(data_grids)} grids in '{mode.upper()}' mode...")
        merged_grid = data_grids[0]
        
        if mode == "grid":
            for next_grid in data_grids[1:]:
                for row_idx, row_data in enumerate(next_grid):
                    if row_idx < len(merged_grid):
                        merged_grid[row_idx].extend(row_data)
                    else:
                        merged_grid.append(row_data)
        elif mode == "document":
            for next_grid in data_grids[1:]:
                merged_grid.extend(next_grid)
                    
        print(f"[DEBUG] Final assembled grid has {len(merged_grid)} rows.")
        return merged_grid