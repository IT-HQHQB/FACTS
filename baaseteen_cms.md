classDiagram
direction BT
class applicants {
   varchar(8) its_number
   varchar(250) full_name
   enum('male', 'female') gender
   int age
   varchar(10) country_code
   varchar(25) phone
   varchar(100) email
   longtext photo  /* Base64 encoded image data */
   text address
   int jamaat_id
   varchar(255) jamaat_name
   int jamiat_id
   varchar(255) jamiat_name
   timestamp created_at
   timestamp updated_at
   int id
}
class assessment {
   int case_id
   text background_education
   text background_work_experience
   text background_family_business
   text background_skills_knowledge
   text background_counselor_assessment
   varchar(255) trade_mark
   varchar(255) online_presence
   varchar(255) digital_marketing
   varchar(255) store_location
   text proposed_present_business_condition  /* 3.2.1. Present Business Condition */
   text proposed_sourcing
   text proposed_selling
   text proposed_major_expenses
   text proposed_goods_purchase  /* 3.2.5. From where goods purchase/credit period/cash, products... */
   text proposed_revenue  /* 3.2.6. Revenue */
   varchar(255) proposed_profit_margin  /* 3.2.7. Profit Margin */
   text counselor_demand_supply
   text counselor_growth_potential
   text counselor_competition_strategy
   longtext counselor_support_needed
   timestamp created_at
   timestamp updated_at
   int id
}
class assessment_products_services {
   int assessment_id
   text product_service
   varchar(50) unit
   decimal(10,2) cost
   decimal(10,2) price
   timestamp created_at
   timestamp updated_at
   int id
}
class attachments {
   int case_id
   tinyint(1) work_place_photo
   tinyint(1) quotation
   tinyint(1) product_brochure
   tinyint(1) income_tax_return
   tinyint(1) financial_statements
   int cancelled_cheque  /* Cancelled Cheque file count */
   int pan_card  /* PAN Card file count */
   int aadhar_card  /* Aadhar Card file count */
   tinyint(1) other_documents
   timestamp created_at
   timestamp updated_at
   int id
}
class business_assets {
   int case_id
   decimal(15,2) cash_in_hand_last_year
   decimal(15,2) cash_in_hand_year1
   decimal(15,2) cash_in_hand_year2
   decimal(15,2) cash_in_hand_year3
   decimal(15,2) cash_in_hand_year4
   decimal(15,2) cash_in_hand_year5
   decimal(15,2) raw_materials_last_year
   decimal(15,2) raw_materials_year1
   decimal(15,2) raw_materials_year2
   decimal(15,2) raw_materials_year3
   decimal(15,2) raw_materials_year4
   decimal(15,2) raw_materials_year5
   decimal(15,2) sale_on_credit_last_year
   decimal(15,2) sale_on_credit_year1
   decimal(15,2) sale_on_credit_year2
   decimal(15,2) sale_on_credit_year3
   decimal(15,2) sale_on_credit_year4
   decimal(15,2) sale_on_credit_year5
   decimal(15,2) machines_equipment_last_year
   decimal(15,2) machines_equipment_year1
   decimal(15,2) machines_equipment_year2
   decimal(15,2) machines_equipment_year3
   decimal(15,2) machines_equipment_year4
   decimal(15,2) machines_equipment_year5
   decimal(15,2) vehicles_last_year
   decimal(15,2) vehicles_year1
   decimal(15,2) vehicles_year2
   decimal(15,2) vehicles_year3
   decimal(15,2) vehicles_year4
   decimal(15,2) vehicles_year5
   decimal(15,2) shop_godown_last_year
   decimal(15,2) shop_godown_year1
   decimal(15,2) shop_godown_year2
   decimal(15,2) shop_godown_year3
   decimal(15,2) shop_godown_year4
   decimal(15,2) shop_godown_year5
   decimal(15,2) trademark_goodwill_last_year
   decimal(15,2) trademark_goodwill_year1
   decimal(15,2) trademark_goodwill_year2
   decimal(15,2) trademark_goodwill_year3
   decimal(15,2) trademark_goodwill_year4
   decimal(15,2) trademark_goodwill_year5
   decimal(15,2) purchase_on_credit_last_year
   decimal(15,2) purchase_on_credit_year1
   decimal(15,2) purchase_on_credit_year2
   decimal(15,2) purchase_on_credit_year3
   decimal(15,2) purchase_on_credit_year4
   decimal(15,2) purchase_on_credit_year5
   timestamp created_at
   timestamp updated_at
   int id
}
class case_attachments {
   int case_id
   varchar(255) file_name
   varchar(500) file_path
   varchar(100) file_type
   int file_size
   int uploaded_by
   varchar(50) stage
   timestamp created_at
   int id
}
class case_closure_documents {
   int case_closure_id
   varchar(500) file_path
   varchar(255) file_name
   varchar(100) file_type
   bigint file_size
   timestamp created_at
   int id
}
class case_closures {
   int case_id
   text reason
   varchar(500) document_path
   varchar(255) document_name
   varchar(100) document_type
   bigint document_size
   int closed_by
   timestamp created_at
   int id
}
class case_comments {
   int case_id
   int user_id
   varchar(50) role_name
   text comment
   enum('general', 'rejection', 'approval', 'note') comment_type
   tinyint(1) is_visible_to_dcm
   int executive_level
   timestamp created_at
   int id
}
class case_identification_income_logs {
   int case_identification_id
   int old_individual_income
   int new_individual_income
   int old_family_income
   int new_family_income
   int changed_by
   timestamp changed_at
   int id
}
class case_identifications {
   varchar(8) its_number
   varchar(255) full_name
   int age
   varchar(20) gender
   varchar(20) phone
   varchar(255) email
   longtext photo
   text address
   varchar(100) jamiat
   varchar(100) jamaat
   int eligible_in
   int total_family_members
   int earning_family_members
   int individual_income
   int family_income
   text remarks
   enum('pending', 'eligible', 'ineligible') status
   int reviewed_by
   datetime reviewed_at
   text review_remarks
   int case_id
   int created_by
   timestamp created_at
   timestamp updated_at
   int id
}
class case_types {
   varchar(100) name
   text description
   tinyint(1) is_active
   int sort_order
   timestamp created_at
   timestamp updated_at
   int id
}
class cases {
   varchar(50) case_number
   int applicant_id
   enum('baaseteen', 'shnd', 'ces') case_type
   int jamiat_id
   int jamaat_id
   text description
   text notes
   varchar(50) assigned_role
   varchar(64) status
   int current_executive_level
   int current_workflow_stage_id
   longtext workflow_history
   text last_welfare_comment
   int roles
   int assigned_counselor_id
   date estimated_end_date
   timestamp registration_date
   timestamp file_submission_date
   timestamp executive_approval_date
   timestamp manzoori_receipt_date
   timestamp first_disbursement_date
   timestamp completion_date
   int created_by
   timestamp created_at
   timestamp updated_at
   enum('low', 'medium', 'high', 'urgent') priority
   int priority_id
   int case_type_id
   int status_id
   is_duplicate  /* 1 = flagged as duplicate (multiple active cases for same ITS) */ tinyint(1)
   int id
}
class counseling_form_stage_permissions {
   int role_id
   varchar(50) stage_key
   varchar(100) stage_name
   tinyint(1) can_read
   tinyint(1) can_update
   timestamp created_at
   timestamp updated_at
   int id
}
class counseling_forms {
   int case_id
   tinyint(1) is_complete
   timestamp completed_at
   timestamp created_at
   timestamp updated_at
   int personal_details_id
   int family_details_id
   int assessment_id
   int financial_assistance_id
   int economic_growth_id
   int declaration_id
   int attachments_id
   int id
}
class cover_letter_forms {
   int case_id
   varchar(255) applicant_name
   varchar(255) applicant_jamiat
   varchar(255) applicant_jamaat
   int applicant_age
   varchar(20) applicant_contact_number
   varchar(50) applicant_case_id
   varchar(20) applicant_its
   longtext applicant_photo
   varchar(255) counsellor_name
   varchar(255) counsellor_jamiat
   varchar(255) counsellor_jamaat
   int counsellor_age
   varchar(20) counsellor_contact_number
   varchar(20) counsellor_its
   tinyint(1) counsellor_certified
   longtext counsellor_photo
   decimal(15,2) current_personal_income
   decimal(15,2) current_family_income
   int earning_family_members
   int dependents
   varchar(255) asset_house
   varchar(255) asset_shop
   varchar(255) asset_gold
   varchar(255) asset_machinery
   varchar(255) asset_stock
   decimal(15,2) liability_qardan
   decimal(15,2) liability_den
   decimal(15,2) liability_others
   varchar(255) business_name
   varchar(255) industry_segment
   varchar(255) present_occupation
   decimal(15,2) requested_enayat
   decimal(15,2) requested_qardan
   decimal(15,2) requested_total
   decimal(15,2) recommended_enayat
   decimal(15,2) recommended_qardan
   decimal(15,2) recommended_total
   decimal(15,2) applicant_projected_income_after_1_year
   decimal(15,2) applicant_projected_income_after_2_years
   decimal(15,2) applicant_projected_income_after_3_years
   decimal(15,2) applicant_projected_income_after_4_years
   decimal(15,2) applicant_projected_income_after_5_years
   decimal(15,2) family_projected_income_after_1_year
   decimal(15,2) family_projected_income_after_2_years
   decimal(15,2) family_projected_income_after_3_years
   decimal(15,2) family_projected_income_after_4_years
   decimal(15,2) family_projected_income_after_5_years
   decimal(15,2) approved_enayat
   decimal(15,2) approved_qardan
   int approved_qh_months
   varchar(20) welfare_department_its
   varchar(255) welfare_department_name
   date welfare_department_date
   varchar(20) zonal_incharge_its
   varchar(255) zonal_incharge_name
   date zonal_incharge_date
   varchar(20) operations_head_its
   varchar(255) operations_head_name
   date operations_head_date
   varchar(10) welfare_department_signature_type
   text welfare_department_signature_file_path
   text welfare_department_signature_drawing_data
   varchar(10) zonal_incharge_signature_type
   text zonal_incharge_signature_file_path
   text zonal_incharge_signature_drawing_data
   varchar(10) operations_head_signature_type
   text operations_head_signature_file_path
   text operations_head_signature_drawing_data
   text proposed_upliftment_plan
   text non_financial_assistance
   text welfare_department_comments
   tinyint(1) is_complete
   int submitted_by
   timestamp submitted_at
   timestamp created_at
   timestamp updated_at
   int id
}
class cover_letters {
   int case_id
   varchar(500) file_path
   timestamp generated_at
   int generated_by
   int id
}
class declaration {
   int case_id
   text applicant_confirmation
   varchar(20) applicant_its  /* Applicant ITS Number */
   varchar(255) applicant_name
   varchar(20) applicant_contact
   date declaration_date
   enum('upload', 'draw') signature_type
   longtext signature_file_path
   text signature_drawing_data
   text other_comments
   varchar(255) applicant_signature
   text counselor_confirmation
   varchar(20) counselor_its  /* Counselor ITS Number */
   varchar(255) counselor_name
   varchar(20) counselor_contact
   date counselor_date
   enum('upload', 'draw') counselor_signature_type
   text counselor_comments  /* Counselor Comments */
   longtext counselor_signature  /* Counselor Signature */
   longtext counselor_signature_file_path
   text counselor_signature_drawing_data
   varchar(20) tr_committee_its  /* TR Committee Member ITS Number */
   varchar(255) tr_committee_name
   varchar(20) tr_committee_contact
   date tr_committee_date
   enum('upload', 'draw') tr_committee_signature_type
   longtext tr_committee_signature_file_path
   text tr_committee_signature_drawing_data
   varchar(255) tr_committee_signature
   timestamp created_at
   timestamp updated_at
   int id
}
class economic_growth {
   int case_id
   timestamp created_at
   timestamp updated_at
   decimal(15,2) cash_in_hand_last_year
   decimal(15,2) cash_in_hand_year1
   decimal(15,2) cash_in_hand_year2
   decimal(15,2) cash_in_hand_year3
   decimal(15,2) cash_in_hand_year4
   decimal(15,2) cash_in_hand_year5
   decimal(15,2) raw_materials_last_year
   decimal(15,2) raw_materials_year1
   decimal(15,2) raw_materials_year2
   decimal(15,2) raw_materials_year3
   decimal(15,2) raw_materials_year4
   decimal(15,2) raw_materials_year5
   decimal(15,2) sale_on_credit_last_year
   decimal(15,2) sale_on_credit_year1
   decimal(15,2) sale_on_credit_year2
   decimal(15,2) sale_on_credit_year3
   decimal(15,2) sale_on_credit_year4
   decimal(15,2) sale_on_credit_year5
   decimal(15,2) machines_equipment_last_year
   decimal(15,2) machines_equipment_year1
   decimal(15,2) machines_equipment_year2
   decimal(15,2) machines_equipment_year3
   decimal(15,2) machines_equipment_year4
   decimal(15,2) machines_equipment_year5
   decimal(15,2) vehicles_last_year
   decimal(15,2) vehicles_year1
   decimal(15,2) vehicles_year2
   decimal(15,2) vehicles_year3
   decimal(15,2) vehicles_year4
   decimal(15,2) vehicles_year5
   decimal(15,2) shop_godown_last_year
   decimal(15,2) shop_godown_year1
   decimal(15,2) shop_godown_year2
   decimal(15,2) shop_godown_year3
   decimal(15,2) shop_godown_year4
   decimal(15,2) shop_godown_year5
   decimal(15,2) trademark_goodwill_last_year
   decimal(15,2) trademark_goodwill_year1
   decimal(15,2) trademark_goodwill_year2
   decimal(15,2) trademark_goodwill_year3
   decimal(15,2) trademark_goodwill_year4
   decimal(15,2) trademark_goodwill_year5
   decimal(15,2) purchase_on_credit_last_year
   decimal(15,2) purchase_on_credit_year1
   decimal(15,2) purchase_on_credit_year2
   decimal(15,2) purchase_on_credit_year3
   decimal(15,2) purchase_on_credit_year4
   decimal(15,2) purchase_on_credit_year5
   decimal(15,2) revenue_sales_last_year
   decimal(15,2) revenue_sales_year1
   decimal(15,2) revenue_sales_year2
   decimal(15,2) revenue_sales_year3
   decimal(15,2) revenue_sales_year4
   decimal(15,2) revenue_sales_year5
   decimal(15,2) expenses_raw_material_last_year
   decimal(15,2) expenses_raw_material_year1
   decimal(15,2) expenses_raw_material_year2
   decimal(15,2) expenses_raw_material_year3
   decimal(15,2) expenses_raw_material_year4
   decimal(15,2) expenses_raw_material_year5
   decimal(15,2) expenses_labor_salary_last_year
   decimal(15,2) expenses_labor_salary_year1
   decimal(15,2) expenses_labor_salary_year2
   decimal(15,2) expenses_labor_salary_year3
   decimal(15,2) expenses_labor_salary_year4
   decimal(15,2) expenses_labor_salary_year5
   decimal(15,2) expenses_rent_last_year
   decimal(15,2) expenses_rent_year1
   decimal(15,2) expenses_rent_year2
   decimal(15,2) expenses_rent_year3
   decimal(15,2) expenses_rent_year4
   decimal(15,2) expenses_rent_year5
   decimal(15,2) expenses_overhead_misc_last_year
   decimal(15,2) expenses_overhead_misc_year1
   decimal(15,2) expenses_overhead_misc_year2
   decimal(15,2) expenses_overhead_misc_year3
   decimal(15,2) expenses_overhead_misc_year4
   decimal(15,2) expenses_overhead_misc_year5
   decimal(15,2) expenses_repair_maintenance_depreciation_last_year
   decimal(15,2) expenses_repair_maintenance_depreciation_year1
   decimal(15,2) expenses_repair_maintenance_depreciation_year2
   decimal(15,2) expenses_repair_maintenance_depreciation_year3
   decimal(15,2) expenses_repair_maintenance_depreciation_year4
   decimal(15,2) expenses_repair_maintenance_depreciation_year5
   decimal(15,2) total_expenses_last_year
   decimal(15,2) total_expenses_year1
   decimal(15,2) total_expenses_year2
   decimal(15,2) total_expenses_year3
   decimal(15,2) total_expenses_year4
   decimal(15,2) total_expenses_year5
   decimal(15,2) profit_last_year
   decimal(15,2) profit_year1
   decimal(15,2) profit_year2
   decimal(15,2) profit_year3
   decimal(15,2) profit_year4
   decimal(15,2) profit_year5
   decimal(15,2) profit_fund_blocked_last_year
   decimal(15,2) profit_fund_blocked_year1
   decimal(15,2) profit_fund_blocked_year2
   decimal(15,2) profit_fund_blocked_year3
   decimal(15,2) profit_fund_blocked_year4
   decimal(15,2) profit_fund_blocked_year5
   decimal(15,2) profit_qardan_repayment_last_year
   decimal(15,2) profit_qardan_repayment_year1
   decimal(15,2) profit_qardan_repayment_year2
   decimal(15,2) profit_qardan_repayment_year3
   decimal(15,2) profit_qardan_repayment_year4
   decimal(15,2) profit_qardan_repayment_year5
   profit_other_income_last_year  /* Other Income - Last Year (Present) */ decimal(15,2)
   profit_other_income_year1  /* Other Income - Year 1 (Projected) */ decimal(15,2)
   profit_other_income_year2  /* Other Income - Year 2 (Projected) */ decimal(15,2)
   profit_other_income_year3  /* Other Income - Year 3 (Projected) */ decimal(15,2)
   profit_other_income_year4  /* Other Income - Year 4 (Projected) */ decimal(15,2)
   profit_other_income_year5  /* Other Income - Year 5 (Projected) */ decimal(15,2)
   decimal(15,2) profit_household_expense_last_year
   decimal(15,2) profit_household_expense_year1
   decimal(15,2) profit_household_expense_year2
   decimal(15,2) profit_household_expense_year3
   decimal(15,2) profit_household_expense_year4
   decimal(15,2) profit_household_expense_year5
   decimal(15,2) cash_surplus_last_year
   decimal(15,2) cash_surplus_year1
   decimal(15,2) cash_surplus_year2
   decimal(15,2) cash_surplus_year3
   decimal(15,2) cash_surplus_year4
   decimal(15,2) cash_surplus_year5
   cash_surplus_additional_enayat_last_year  /* Additional Enayat - Last Year (Present) */ decimal(15,2)
   cash_surplus_additional_enayat_year1  /* Additional Enayat - Year 1 (Projected) */ decimal(15,2)
   cash_surplus_additional_enayat_year2  /* Additional Enayat - Year 2 (Projected) */ decimal(15,2)
   cash_surplus_additional_enayat_year3  /* Additional Enayat - Year 3 (Projected) */ decimal(15,2)
   cash_surplus_additional_enayat_year4  /* Additional Enayat - Year 4 (Projected) */ decimal(15,2)
   cash_surplus_additional_enayat_year5  /* Additional Enayat - Year 5 (Projected) */ decimal(15,2)
   decimal(15,2) cash_surplus_additional_qardan_last_year
   decimal(15,2) cash_surplus_additional_qardan_year1
   decimal(15,2) cash_surplus_additional_qardan_year2
   decimal(15,2) cash_surplus_additional_qardan_year3
   decimal(15,2) cash_surplus_additional_qardan_year4
   decimal(15,2) cash_surplus_additional_qardan_year5
   int id
}
class economic_growth_projections {
   int economic_growth_id
   varchar(255) category
   decimal(15,2) present
   decimal(15,2) year1
   decimal(15,2) year2
   decimal(15,2) year3
   decimal(15,2) year4
   decimal(15,2) year5
   timestamp created_at
   timestamp updated_at
   int id
}
class education_levels {
   varchar(100) name
   text description
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class executive_levels {
   int level_number
   varchar(100) level_name
   text description
   tinyint(1) is_active
   int sort_order
   timestamp created_at
   timestamp updated_at
   int id
}
class family_details {
   int case_id
   varchar(100) family_structure
   text other_details
   varchar(255) wellbeing_food
   text wellbeing_housing
   text wellbeing_education
   text wellbeing_health
   text wellbeing_deeni
   text wellbeing_ziyarat_travel_recreation
   decimal(15,2) income_business_monthly
   decimal(15,2) income_business_yearly
   decimal(15,2) income_salary_monthly
   decimal(15,2) income_salary_yearly
   decimal(15,2) income_home_industry_monthly
   decimal(15,2) income_home_industry_yearly
   decimal(15,2) income_others_monthly
   decimal(15,2) income_others_yearly
   decimal(15,2) income_total_monthly
   decimal(15,2) income_total_yearly
   decimal(15,2) expense_food_monthly
   decimal(15,2) expense_food_yearly
   decimal(15,2) expense_housing_monthly
   decimal(15,2) expense_housing_yearly
   decimal(15,2) expense_health_monthly
   decimal(15,2) expense_health_yearly
   decimal(15,2) expense_transport_monthly
   decimal(15,2) expense_transport_yearly
   decimal(15,2) expense_education_monthly
   decimal(15,2) expense_education_yearly
   decimal(15,2) expense_deeni_monthly
   decimal(15,2) expense_deeni_yearly
   decimal(15,2) expense_essentials_monthly
   decimal(15,2) expense_essentials_yearly
   decimal(15,2) expense_non_essentials_monthly
   decimal(15,2) expense_non_essentials_yearly
   decimal(15,2) expense_others_monthly
   decimal(15,2) expense_others_yearly
   decimal(15,2) expense_total_monthly
   decimal(15,2) expense_total_yearly
   decimal(15,2) surplus_monthly
   decimal(15,2) surplus_yearly
   decimal(15,2) deficit_monthly
   decimal(15,2) deficit_yearly
   decimal(15,2) scholarship_monthly
   decimal(15,2) scholarship_yearly
   decimal(15,2) borrowing_monthly
   decimal(15,2) borrowing_yearly
   varchar(250) assets_residential
   varchar(256) assets_shop_godown_land
   varchar(256) assets_machinery_vehicle
   varchar(255) assets_stock_raw_material
   varchar(255) assets_goods_sold_credit
   varchar(255) assets_others
   decimal(15,2) liabilities_borrowing_qardan
   decimal(15,2) liabilities_goods_credit
   decimal(15,2) liabilities_others
   decimal(15,2) liabilities_total
   timestamp created_at
   timestamp updated_at
   int id
}
class family_members {
   int family_details_id
   varchar(100) name
   int age
   int relation_id
   int education_id
   int occupation_id
   decimal(15,2) annual_income
   timestamp created_at
   timestamp updated_at
   int id
}
class financial_assistance {
   int case_id
   text assistance_required
   decimal(15,2) self_funding
   decimal(15,2) rahen_available
   decimal(15,2) repayment_year1
   decimal(15,2) repayment_year2
   decimal(15,2) repayment_year3
   decimal(15,2) repayment_year4
   decimal(15,2) repayment_year5
   json support_needed
   text support_industry_knowledge_desc
   text support_sourcing_desc
   text support_sales_market_desc
   text support_internship_desc
   text support_mentoring_handholding_desc
   text support_bookkeeping_desc
   json qh_fields
   timestamp created_at
   timestamp updated_at
   int id
}
class financial_assistance_action_plan {
   int financial_assistance_id
   varchar(50) timeline_period  /* Timeline period: upto_1st_year_end, 2nd_and_3rd_year, 4th_and... */
   int action_number  /* Sequential action number across all periods */
   text action_text  /* The action description */
   timestamp created_at
   timestamp updated_at
   int id
}
class financial_assistance_mentors {
   int financial_assistance_id
   its_number  /* ITS number of the mentor (8 digits) */ varchar(8)
   varchar(255) name  /* Full name of the mentor */
   varchar(20) contact_number  /* Contact number of the mentor */
   varchar(255) email  /* Email address of the mentor */
   text photo  /* Base64 encoded photo data */
   timestamp created_at
   timestamp updated_at
   int id
}
class financial_assistance_qh_repayment_schedule {
   int financial_assistance_id
   varchar(10) qh_name
   decimal(15,2) year1
   decimal(15,2) year2
   decimal(15,2) year3
   decimal(15,2) year4
   decimal(15,2) year5
   timestamp created_at
   timestamp updated_at
   int id
}
class financial_assistance_timeline {
   int financial_assistance_id
   purpose  /* Purpose (end-use) & Cost */ varchar(255)
   decimal(15,2) enayat  /* Enayat amount */
   decimal(15,2) qardan  /* Qardan amount */
   int months  /* Months for repayment */
   timestamp created_at
   timestamp updated_at
   int id
}
class financial_assistance_timeline_assistance {
   int financial_assistance_id
   varchar(50) timeline_period  /* Timeline period: immediate, after_1st_yr, after_2nd_yr, after... */
   int action_number  /* Sequential action number across all periods */
   purpose_cost  /* Purpose (end-use) & Cost */ text
   decimal(15,2) enayat  /* Enayat amount */
   decimal(15,2) qardan  /* Qardan amount */
   int months  /* Months for repayment */
   timestamp created_at
   timestamp updated_at
   int id
}
class fund_utilization_files {
   int fund_utilization_id
   int question_id
   varchar(500) file_path
   varchar(255) file_name
   bigint file_size
   varchar(100) mime_type
   timestamp created_at
   int id
}
class fund_utilization_photos {
   int fund_utilization_id
   varchar(500) file_path
   varchar(255) file_name
   enum('shop_site', 'stock_equipment', 'applicant_work', 'other') photo_type
   timestamp created_at
   int id
}
class fund_utilization_questions {
   int section_id
   varchar(500) label
   varchar(50) field_type
   text options_json
   int min_length
   int max_length
   int max_file_size_mb
   int max_files
   json table_config
   int parent_question_id
   text parent_trigger_values
   varchar(255) placeholder
   int sort_order
   tinyint(1) is_required
   tinyint(1) is_auto_fill
   varchar(50) auto_fill_key
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class fund_utilization_reports {
   int case_id
   enum('q1', 'q2', 'q3', 'q4') quarter
   int year
   longtext responses_json
   int created_by
   int updated_by
   timestamp created_at
   timestamp updated_at
   int id
}
class fund_utilization_sections {
   varchar(200) title
   int sort_order
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class jamaat {
   varchar(20) jamaat_id
   int jamiat_id
   varchar(200) name
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int created_by
   int updated_by
   int id
}
class jamiat {
   varchar(20) jamiat_id
   varchar(200) name
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int created_by
   int updated_by
   int id
}
class notifications {
   int user_id
   int case_id
   varchar(255) title
   text message
   enum('info', 'warning', 'success', 'error') type
   tinyint(1) is_read
   timestamp created_at
   int id
}
class occupations {
   varchar(100) name
   text description
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class payment_schedule_repayments {
   int payment_schedule_id
   year repayment_year
   repayment_month  /* Month number (1-12) */ int
   decimal(15,2) repayment_amount
   timestamp created_at
   timestamp updated_at
   int id
}
class payment_schedules {
   int case_id
   enum('qardan_hasana', 'enayat') payment_type
   int year_number  /* Year 1, 2, 3, 4, or 5 */
   year disbursement_year
   disbursement_month  /* Month number (1-12) */ int
   decimal(15,2) disbursement_amount
   repayment_months  /* Number of repayment months (only for QH) */ int
   repayment_start_year  /* Year when repayment starts (only for QH) */ year
   repayment_start_month  /* Month when repayment starts (only for QH) */ int
   int created_by
   int updated_by
   timestamp created_at
   timestamp updated_at
   tinyint(1) is_disbursed  /* Whether the payment has been confirmed/disbursed */
   date disbursed_date  /* Actual date when amount was disbursed */
   int disbursed_by  /* User who confirmed the disbursement */
   timestamp disbursed_at  /* Timestamp when disbursement was confirmed */
   int id
}
class personal_details {
   int case_id
   varchar(50) its_number
   varchar(255) name
   int age
   varchar(255) education
   varchar(100) jamiat
   varchar(100) jamaat
   varchar(20) contact_number
   varchar(100) email
   text residential_address
   varchar(255) present_occupation
   text occupation_address
   text other_info
   timestamp created_at
   timestamp updated_at
   int id
}
class relations {
   varchar(100) name
   text description
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class role_permissions {
   int role_id
   varchar(100) permission
   varchar(100) resource
   varchar(50) action
   timestamp created_at
   int id
}
class roles {
   varchar(50) name
   varchar(100) display_name
   text description
   longtext permissions
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   tinyint(1) is_system_role
   int id
}
class status_history {
   int case_id
   varchar(50) from_status
   varchar(50) to_status
   int changed_by
   text comments
   timestamp created_at
   int id
}
class statuses {
   varchar(100) name
   text description
   varchar(20) color
   tinyint(1) is_active
   int sort_order
   tinyint(1) is_final
   timestamp created_at
   timestamp updated_at
   int id
}
class system_settings {
   varchar(100) setting_key
   text setting_value
   text description
   int updated_by
   timestamp updated_at
   int id
}
class user_roles {
   int user_id
   int role_id
   int assigned_by
   timestamp assigned_at
   timestamp expires_at
   tinyint(1) is_active
   text jamiat_ids  /* Comma-separated jamiat IDs for this role */
   text jamaat_ids  /* Comma-separated jamaat IDs for this role */
   int id
}
class users {
   varchar(50) username
   varchar(200) full_name
   varchar(100) email
   varchar(20) phone
   varchar(50) its_number  /* ITS number for user identification */
   longtext photo  /* Base64 encoded image data */
   text jamiat_ids
   text jamaat_ids
   int jamiat_id
   int jamaat_id
   varchar(255) password_hash
   varchar(50) role
   int executive_level
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class welfare_checklist_categories {
   varchar(200) category_name
   text description
   int sort_order
   tinyint(1) is_active
   timestamp created_at
   timestamp updated_at
   int id
}
class welfare_checklist_items {
   int category_id
   varchar(50) form_section
   text checklist_detail
   int sort_order
   tinyint(1) is_active
   tinyint(1) is_compulsory
   timestamp created_at
   timestamp updated_at
   int id
}
class welfare_checklist_responses {
   int case_id
   int checklist_item_id
   enum('y', 'n') properly_filled
   text comments
   text overall_remarks
   int filled_by
   timestamp filled_at
   timestamp updated_at
   int id
}
class workflow_comments {
   int case_id
   int user_id
   varchar(50) workflow_step
   text comment
   enum('general', 'note', 'feedback', 'approval', 'rejection') comment_type
   timestamp created_at
   timestamp updated_at
   int id
}
class workflow_stage_roles {
   int workflow_stage_id
   int role_id
   tinyint(1) can_approve
   tinyint(1) can_reject
   tinyint(1) can_review
   tinyint(1) can_view
   tinyint(1) can_create_case
   tinyint(1) can_fill_case
   timestamp created_at
   tinyint(1) can_edit
   tinyint(1) can_delete
   int id
}
class workflow_stage_users {
   int workflow_stage_id
   int user_id
   tinyint(1) can_approve
   tinyint(1) can_reject
   tinyint(1) can_review
   tinyint(1) can_view
   tinyint(1) can_create_case
   tinyint(1) can_fill_case
   timestamp created_at
   tinyint(1) can_edit
   tinyint(1) can_delete
   int id
}
class workflow_stages {
   varchar(100) stage_name
   varchar(50) stage_key
   text description
   int sort_order
   int next_stage_id
   tinyint(1) auto_advance_on_approve
   tinyint(1) requires_comments_on_reject
   tinyint(1) is_active
   int case_type_id
   timestamp created_at
   timestamp updated_at
   longtext associated_statuses  /* JSON array of case statuses that trigger this workflow stage */
   decimal(10,2) sla_value
   enum('hours', 'days', 'business_days', 'weeks', 'months') sla_unit
   decimal(10,2) sla_warning_value
   enum('hours', 'days', 'business_days', 'weeks', 'months') sla_warning_unit
   int id
}

applicants  -->  jamaat : jamaat_id:id
applicants  -->  jamiat : jamiat_id:id
assessment  -->  cases : case_id:id
assessment_products_services  -->  assessment : assessment_id:id
attachments  -->  cases : case_id:id
business_assets  -->  cases : case_id:id
case_attachments  -->  cases : case_id:id
case_attachments  -->  users : uploaded_by:id
case_closure_documents  -->  case_closures : case_closure_id:id
case_closures  -->  cases : case_id:id
case_closures  -->  users : closed_by:id
case_comments  -->  cases : case_id:id
case_comments  -->  users : user_id:id
case_identification_income_logs  -->  case_identifications : case_identification_id:id
case_identification_income_logs  -->  users : changed_by:id
case_identifications  -->  case_types : eligible_in:id
case_identifications  -->  cases : case_id:id
case_identifications  -->  users : reviewed_by:id
case_identifications  -->  users : created_by:id
cases  -->  applicants : applicant_id:id
cases  -->  case_types : case_type_id:id
cases  -->  jamaat : jamaat_id:id
cases  -->  jamiat : jamiat_id:id
cases  -->  statuses : status_id:id
cases  -->  users : roles:id
cases  -->  users : assigned_counselor_id:id
cases  -->  users : created_by:id
cases  -->  workflow_stages : current_workflow_stage_id:id
counseling_form_stage_permissions  -->  roles : role_id:id
counseling_forms  -->  assessment : assessment_id:id
counseling_forms  -->  attachments : attachments_id:id
counseling_forms  -->  cases : case_id:id
counseling_forms  -->  declaration : declaration_id:id
counseling_forms  -->  economic_growth : economic_growth_id:id
counseling_forms  -->  family_details : family_details_id:id
counseling_forms  -->  financial_assistance : financial_assistance_id:id
counseling_forms  -->  personal_details : personal_details_id:id
cover_letter_forms  -->  cases : case_id:id
cover_letter_forms  -->  users : submitted_by:id
cover_letters  -->  cases : case_id:id
cover_letters  -->  users : generated_by:id
declaration  -->  cases : case_id:id
economic_growth  -->  cases : case_id:id
economic_growth_projections  -->  economic_growth : economic_growth_id:id
family_details  -->  cases : case_id:id
family_members  -->  family_details : family_details_id:id
family_members  -->  occupations : occupation_id:id
family_members  -->  relations : relation_id:id
financial_assistance  -->  cases : case_id:id
financial_assistance_action_plan  -->  financial_assistance : financial_assistance_id:id
financial_assistance_mentors  -->  financial_assistance : financial_assistance_id:id
financial_assistance_qh_repayment_schedule  -->  financial_assistance : financial_assistance_id:id
financial_assistance_timeline  -->  financial_assistance : financial_assistance_id:id
financial_assistance_timeline_assistance  -->  financial_assistance : financial_assistance_id:id
fund_utilization_files  -->  fund_utilization_questions : question_id:id
fund_utilization_files  -->  fund_utilization_reports : fund_utilization_id:id
fund_utilization_photos  -->  fund_utilization_reports : fund_utilization_id:id
fund_utilization_questions  -->  fund_utilization_questions : parent_question_id:id
fund_utilization_questions  -->  fund_utilization_sections : section_id:id
fund_utilization_reports  -->  cases : case_id:id
fund_utilization_reports  -->  users : updated_by:id
fund_utilization_reports  -->  users : created_by:id
jamaat  -->  jamaat : jamaat_id:id
jamaat  -->  jamiat : jamiat_id:id
jamaat  -->  users : updated_by:id
jamaat  -->  users : created_by:id
jamiat  -->  jamiat : jamiat_id:id
jamiat  -->  users : created_by:id
jamiat  -->  users : updated_by:id
notifications  -->  cases : case_id:id
notifications  -->  users : user_id:id
payment_schedule_repayments  -->  payment_schedules : payment_schedule_id:id
payment_schedules  -->  cases : case_id:id
payment_schedules  -->  users : created_by:id
payment_schedules  -->  users : disbursed_by:id
payment_schedules  -->  users : updated_by:id
personal_details  -->  cases : case_id:id
role_permissions  -->  roles : role_id:id
status_history  -->  cases : case_id:id
status_history  -->  users : changed_by:id
system_settings  -->  users : updated_by:id
user_roles  -->  roles : role_id:id
user_roles  -->  users : assigned_by:id
user_roles  -->  users : user_id:id
users  -->  executive_levels : executive_level:level_number
users  -->  jamaat : jamaat_id:id
users  -->  jamiat : jamiat_id:id
welfare_checklist_items  -->  welfare_checklist_categories : category_id:id
welfare_checklist_responses  -->  cases : case_id:id
welfare_checklist_responses  -->  users : filled_by:id
welfare_checklist_responses  -->  welfare_checklist_items : checklist_item_id:id
workflow_comments  -->  cases : case_id:id
workflow_comments  -->  users : user_id:id
workflow_stage_roles  -->  roles : role_id:id
workflow_stage_roles  -->  workflow_stages : workflow_stage_id:id
workflow_stage_users  -->  users : user_id:id
workflow_stage_users  -->  workflow_stages : workflow_stage_id:id
workflow_stages  -->  case_types : case_type_id:id
workflow_stages  -->  workflow_stages : next_stage_id:id
