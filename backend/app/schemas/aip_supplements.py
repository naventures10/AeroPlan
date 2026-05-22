from pydantic import BaseModel


class AipSupplement(BaseModel):
    supplement_number: str
    title: str
    pdf_link: str
    effective_date: str
    remarks: str
