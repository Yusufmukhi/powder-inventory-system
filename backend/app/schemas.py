from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime


# ---------------- SUPPLIERS ----------------
class SupplierCreate(BaseModel):
    name: str
    contact_number: Optional[str] = None


class Supplier(SupplierCreate):
    id: str
    created_at: datetime


# ---------------- CUSTOMERS ----------------
class CustomerCreate(BaseModel):
    name: str
    contact_number: Optional[str] = None
    address: Optional[str] = None


class Customer(CustomerCreate):
    id: str
    created_at: datetime


# ---------------- POWDERS ----------------
class PowderCreate(BaseModel):
    shade_name: str
    default_supplier_id: Optional[str] = None


class Powder(BaseModel):
    id: str
    shade_name: str
    default_supplier_id: Optional[str] = None
    reorder_threshold_kg: float
    created_at: datetime
    updated_at: datetime


class PowderBatchCreate(BaseModel):
    powder_id: str
    supplier_id: str
    price_per_kg: float
    qty_kg: float
    purchase_date: Optional[date] = None
    notes: Optional[str] = None


# ---------------- JOBS ----------------
class JobCreate(BaseModel):
    customer_id: str
    product_name: str
    qty_received: int
    powder_id: str
    date_received: date
    date_promised: date
    notes: Optional[str] = None


class JobEdit(BaseModel):
    product_name: Optional[str] = None
    qty_received: Optional[int] = None
    powder_id: Optional[str] = None
    date_promised: Optional[date] = None
    notes: Optional[str] = None


class JobApprove(BaseModel):
    date_completed: date
    powder_consumed_kg: float
    price_charged: float


class PaymentUpdate(BaseModel):
    payment_status: str
    payment_method: Optional[Literal["cash", "cheque", "upi", "bank_transfer", "card"]] = None
    advance_amount: Optional[float] = None
class PaymentEntryCreate(BaseModel):
    amount: float
    payment_method: Literal["cash", "cheque", "upi", "bank_transfer", "card"]
    paid_date: Optional[date] = None

# ---------------- AUTH / USER MANAGEMENT ----------------
class UserCreate(BaseModel):
    email: str
    username: str
    password: str
    role: str = "shop_floor"   # 'owner' | 'shop_floor'


class PasswordReset(BaseModel):
    """Owner resetting someone else's password (e.g. they've forgotten it)."""
    new_password: str


class PasswordChange(BaseModel):
    """Any logged-in user changing their own password."""
    current_password: str
    new_password: str


# ---------------- COMPANIES (super admin only) ----------------
class CompanyCreate(BaseModel):
    name: str
    max_owners: int = 2
    max_staff: int = 3
    owner_email: str
    owner_password: str


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    max_owners: Optional[int] = None
    max_staff: Optional[int] = None
    subscription_status: Optional[Literal["active", "suspended"]] = None



# ---------------- EXPENSES ----------------
class ExpenseCreate(BaseModel):
    expense_date: date
    category: str          # wages | electricity | other
    description: Optional[str] = None
    amount: float


class AssetCreate(BaseModel):
    name: str
    asset_type: Literal["depreciable", "land"] = "depreciable"
    purchase_price: float
    purchase_date: date
    useful_life_years: Optional[float] = 5   # ignored / stored as null for 'land'
