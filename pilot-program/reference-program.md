# ROOTUIP Customer Reference Program

## Program Overview

The ROOTUIP Customer Reference Program recognizes and rewards our most successful pilot customers who are willing to share their success stories with prospective customers.

## Reference Tiers

### 🥉 Bronze Reference Partner
**Requirements**:
- Completed successful pilot (met 3+ success criteria)
- Willing to take 1-2 reference calls per quarter
- Agreed to logo usage

**Benefits**:
- 5% discount on annual contract
- Early access to new features
- Quarterly business review with product team
- Recognition on website

### 🥈 Silver Reference Partner
**Requirements**:
- All Bronze requirements
- Participated in written case study
- Willing to take 3-4 reference calls per quarter
- Agreed to success metrics sharing

**Benefits**:
- 10% discount on annual contract
- Dedicated customer success manager
- Input on product roadmap
- Speaking opportunity at ROOTUIP webinar
- Co-marketing opportunities

### 🥇 Gold Reference Partner
**Requirements**:
- All Silver requirements
- Video testimonial recorded
- Speaking at ROOTUIP annual conference
- Site visits for prospects (virtual or in-person)
- Executive-to-executive references

**Benefits**:
- 15% discount on annual contract
- Executive quarterly reviews
- Beta access to all new features
- Joint press release
- Featured success story at industry events
- Annual innovation award eligibility

### 💎 Platinum Innovation Partner
**Requirements**:
- All Gold requirements
- Co-innovation project participation
- Thought leadership content creation
- Industry advocacy
- 10+ successful referrals

**Benefits**:
- 20% discount on annual contract
- Dedicated innovation team resources
- Custom feature development priority
- Joint go-to-market initiatives
- Industry award co-nominations
- Advisory board membership

## Reference Request Process

### 1. Request Intake
```yaml
reference_request:
  prospect_company: ""
  prospect_industry: ""
  prospect_size: ""
  key_concerns: []
  preferred_reference_profile:
    industry_match: true/false
    size_match: true/false
    use_case_match: true/false
  timeline: ""
  reference_type: "phone|email|site_visit"
```

### 2. Reference Matching
Our Customer Success team will:
- Match prospect needs with appropriate reference
- Confirm reference availability
- Brief reference on prospect background
- Schedule within 48 hours

### 3. Reference Preparation
**Pre-Call Brief** includes:
- Prospect company overview
- Key evaluation criteria
- Specific questions expected
- Relevant success metrics to highlight
- Call duration and format

### 4. Post-Reference Follow-up
- Debrief with reference customer
- Thank you note and recognition
- Update reference activity tracking
- Share prospect feedback (if appropriate)
- Log toward tier benefits

## Reference Resources

### Speaking Points Guide
**Opening**:
"We've been using ROOTUIP for [timeframe] and have seen [key result]."

**Key Messages**:
1. **Problem Solved**: "Before ROOTUIP, we struggled with [problem]. Now we [solution]."
2. **Quantifiable Results**: "We've achieved [specific metrics]."
3. **Ease of Implementation**: "The pilot was up and running in [timeframe]."
4. **Team Adoption**: "Our team found the platform [adoption story]."
5. **ROI**: "We're seeing [ROI] return on our investment."

**Closing**:
"I'd recommend ROOTUIP to any company facing similar challenges."

### Do's and Don'ts

**DO**:
- Be authentic and honest
- Share specific examples and metrics
- Mention both successes and how challenges were resolved
- Highlight the support received
- Discuss future plans with ROOTUIP

**DON'T**:
- Overpromise results
- Share confidential information
- Discuss pricing without approval
- Compare to specific competitors
- Make commitments on ROOTUIP's behalf

## Reference Recognition

### Quarterly Recognition
- Reference Champion Award
- Most Valuable Success Story
- Innovation Partner of the Quarter
- Feature in customer newsletter

### Annual Recognition
- Reference Partner of the Year
- Presented at annual conference
- Custom award and recognition
- Executive dinner invitation
- Feature in annual report

## Legal and Compliance

### Reference Agreement Components
1. **Consent**: Written agreement to serve as reference
2. **Scope**: Types of reference activities agreed to
3. **Confidentiality**: NDA provisions for both parties
4. **Usage Rights**: Logo, quotes, metrics usage
5. **Term**: Duration of reference agreement
6. **Opt-out**: Process to pause or end participation

### Information Sharing Guidelines
**Can Share**:
- Percentage improvements
- ROI multiples
- Process improvements
- User satisfaction scores
- General use cases

**Cannot Share**:
- Specific dollar amounts (unless approved)
- Competitive information
- Strategic plans
- Unreleased features
- Other customer names

## Reference Tracking System

### Activity Tracking
```sql
CREATE TABLE reference_activities (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    reference_date DATE,
    prospect_company VARCHAR(255),
    reference_type VARCHAR(50),
    outcome VARCHAR(50),
    feedback TEXT,
    time_invested INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Monthly Reporting
- Number of references provided
- Success rate (led to pilot/sale)
- Customer satisfaction scores
- Time invested by customers
- Tier progression tracking

## Building Your Reference Story

### Story Framework
1. **Situation**: What was happening before ROOTUIP?
2. **Challenge**: What specific problems needed solving?
3. **Solution**: How did ROOTUIP address these?
4. **Results**: What measurable outcomes were achieved?
5. **Future**: What's next in the partnership?

### Metrics That Matter
- D&D charges prevented ($)
- Prevention rate (%)
- ROI achieved (X:1)
- Time saved (hours/week)
- User adoption (%)
- Accuracy rate (%)

### Reference Readiness Checklist
- [ ] Pilot success criteria achieved
- [ ] ROI documented and verified
- [ ] Executive approval obtained
- [ ] Legal review completed
- [ ] Success metrics prepared
- [ ] Team briefed on program
- [ ] Speaking points reviewed
- [ ] Case study drafted

## Program Support

### Customer Success Team
- Coordinates all reference requests
- Provides preparation materials
- Handles scheduling and logistics
- Tracks program participation
- Manages recognition and rewards

### Marketing Team
- Creates reference stories
- Develops case studies
- Produces video testimonials
- Manages co-marketing activities
- Handles PR and communications

### Sales Team
- Submits reference requests
- Provides prospect context
- Shares reference feedback
- Tracks impact on deals
- Nominates recognition candidates

## Contact

**Reference Program Manager**  
Email: references@rootuip.com  
Phone: 1-800-ROOTUIP ext. 200

**Emergency Reference Requests**  
For urgent requests (same-day):  
Email: urgent-reference@rootuip.com  
Slack: #reference-911

---

*Thank you for being a ROOTUIP advocate! Your success stories inspire others and help transform the logistics industry.*