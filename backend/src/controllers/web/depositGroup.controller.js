const { DepositGroup, DepositGroupMember, DeliveryOrder, DeliveryOrderPayments, DeliveryOrderAdjustments, PurchaseOrder, sequelize, CashTransaction, DepositGroupInvoice, DepositGroupPayment } = require("../../models");
const { Op, fn, col } = require("sequelize");

// Helper function to get paid amount for a DO
async function getTotalPaidAmount(doId) {
  try {
    const result = await DeliveryOrderPayments.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('payment_amount')), 0), 'total_paid']],
      where: { delivery_order_id: doId },
      raw: true,
    });
    return parseFloat(result?.total_paid || 0);
  } catch (err) {
    console.error('Error calculating paid amount:', err);
    return 0;
  }
}

module.exports = {
  // Add this new method to the depositGroup controller
  // Update the finalizeDOAmount method
  // Add this new method
  // Example controller logic
  // async updateDOQuantity(req, res) {
  //   const { id } = req.params;
  //   const { quantity } = req.body;

  //   try {
  //     const doItem = await DeliveryOrder.findByPk(id);
  //     if (!doItem) {
  //       return res.status(404).json({ error: "DO not found" });
  //     }
  //     // Recalculate total_amount using unit_price from DB
  //     const unitPrice = doItem.unit_price;
  //     const total_amount = quantity * unitPrice;
  //     const final_amount = quantity * unitPrice; // Assuming final amount is same as total for simplicity
  //     await doItem.update({ quantity, total_amount, final_amount });
  //     res.json({ success: true, doItem });
  //   } catch (error) {
  //     console.error("Error updating DO quantity:", error);
  //     res.status(500).json({ error: "Failed to update quantity" });
  //   }
  // },
  // async finalizeDOAmount(req, res) {
  //   const { do_id } = req.params; // ✅ Use the correct parameter name
  //   const { finalized_amount } = req.body;

  //   try {
  //     const deliveryOrder = await DeliveryOrder.findByPk(do_id); // Now uses the correct ID
  //     if (!deliveryOrder) {
  //       return res.status(404).json({ error: 'Delivery Order not found' });
  //     }

  //     await deliveryOrder.update({
  //       final_amount: finalized_amount,
  //       is_amount_finalized: true
  //     });

  //     res.json({ success: true, message: 'Amount finalized successfully', deliveryOrder });
  //   } catch (error) {
  //     console.error('Error finalizing DO amount:', error);
  //     res.status(500).json({ error: 'Failed to finalize amount' });
  //   }
  // },
  // Create new deposit group
  // src/controllers/web/depositGroup.controller.js
  // src/controllers/web/depositGroup.controller.js
  async createGroup(req, res) {
    try {
      const { group_name, target_quantity, deposited_amount, unit, delivery_order_ids = [], purchase_order_id } = req.body;
      
      // *** FIX STARTS HERE ***
      // The initial balance of the group should be the amount that was deposited.
      const balance = deposited_amount; 
      const remaining_quantity = target_quantity; // Initial remaining = target
      
      // If creating from a PO → enforce only one deposit group per PO and name it
      let finalGroupName = group_name;
      let po = null;
      if (purchase_order_id) {
        po = await PurchaseOrder.findByPk(purchase_order_id, {
          include: [{ model: DeliveryOrder, as: 'poDeliveryOrders' }]
        });
        if (!po) {
          return res.status(404).json({ error: 'Purchase Order not found' });
        }
        // Only allow if PO has no DO yet
        if (po.poDeliveryOrders && po.poDeliveryOrders.length > 0) {
          return res.status(400).json({ error: 'Cannot create deposit group: PO already has Delivery Orders' });
        }
        // Enforce single group per PO
        if (po.deposit_group_id) {
          return res.status(400).json({ error: 'This PO already linked to a deposit group' });
        }
        // Name: DEP-PO <customer>
        finalGroupName = `DEP-PO ${po.customer_name}`;
      }

      // If created from PO, take quantities and unit from PO
      const finalTargetQty = po ? parseFloat(po.total_quantity) || 0 : (target_quantity || 0);
      const finalRemainingQty = po ? parseFloat(po.total_quantity) || 0 : (remaining_quantity || target_quantity || 0);
      const finalUnit = po ? (po.unit || unit || 'ton') : (unit || 'ton');

      const group = await DepositGroup.create({
        group_name: finalGroupName || 'Deposit Group',
        balance, // Use the deposited amount as the starting balance
        target_quantity: finalTargetQty,
        deposited_amount,
        remaining_quantity: finalRemainingQty,
        unit: finalUnit,
        status: 'active'
      });

      // Record initial deposit into topup history (for invoice display)
      try {
        const { DepositGroupTopup } = require("../../models");
        if (parseFloat(deposited_amount || 0) > 0) {
          await DepositGroupTopup.create({
            group_id: group.id,
            amount: parseFloat(deposited_amount),
            description: 'Initial deposit'
          });
        }
      } catch (e) {
        console.warn('Failed to record initial topup history:', e?.message || e);
      }

      let doIdsToAdd = delivery_order_ids;

      // If PO is selected, get its DOs
      if (purchase_order_id && po) {
        if (po.poDeliveryOrders) {
          doIdsToAdd = po.poDeliveryOrders.map(doItem => doItem.id);
        }
        // Link PO to this group so future DOs auto-link
        await po.update({ deposit_group_id: group.id });
      }

      // Add DOs to group if provided
      if (doIdsToAdd.length > 0) {
        const deliveryOrders = await DeliveryOrder.findAll({
          where: { id: doIdsToAdd }
        });

        const members = doIdsToAdd.map(do_id => {
          const doItem = deliveryOrders.find(d => d.id === do_id);
          return {
            group_id: group.id,
            delivery_order_id: do_id,
            quantity: doItem ? doItem.minimal_load_quantity : 0
          };
        });

        await DepositGroupMember.bulkCreate(members)
      }

      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating deposit group:", error);
      res.status(500).json({ 
        error: "Failed to create deposit group", 
        details: error.message 
      });
    }
  },

  // Finalize a deposit group and create a group-level invoice: net = gross(actual) - deposited_amount
  async finalizeGroup(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;

      const group = await DepositGroup.findByPk(id, {
        include: [
          {
            model: DepositGroupMember,
            as: 'members',
            include: [
              {
                model: DeliveryOrder,
                as: 'deliveryOrder',
              },
            ],
          },
          { model: PurchaseOrder, as: 'purchaseOrders', required: false },
        ],
        transaction,
      });

      if (!group) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Deposit group not found' });
      }

      // Prevent duplicate finalization if any invoice exists (finalize only once)
      const existingInvoice = await DepositGroupInvoice.findOne({
        where: { group_id: id },
        transaction,
      });
      if (existingInvoice) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Group already has an active invoice' });
      }

      // Compute gross from actual quantities (fallback to minimal if actual not set)
      let grossAmount = 0;
      for (const member of group.members || []) {
        const doItem = member.deliveryOrder;
        if (!doItem) continue;
        const qty = parseFloat(doItem.actual_load_quantity ?? doItem.minimal_load_quantity ?? 0) || 0;
        const price = parseFloat(doItem.unit_price ?? 0) || 0;
        grossAmount += qty * price;
      }

      const depositDeducted = parseFloat(group.deposited_amount || 0) || 0;
      const netAmount = Math.max(0, grossAmount - depositDeducted);

      // Create invoice number
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const seqBase = `DEP/${y}/${m}`;
      const lastInvoice = await DepositGroupInvoice.findOne({
        where: { invoice_number: { [require('sequelize').Op.like]: `${seqBase}/%` } },
        order: [['created_at', 'DESC']],
        transaction,
      });
      let seq = 1;
      if (lastInvoice) {
        const match = String(lastInvoice.invoice_number).match(/DEP\/\d{4}\/\d{2}\/(\d+)/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }
      const invoiceNumber = `${seqBase}/${String(seq).padStart(3, '0')}`;

      const invoice = await DepositGroupInvoice.create(
        {
          group_id: group.id,
          invoice_number: invoiceNumber,
          invoice_date: new Date(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gross_amount: grossAmount,
          deposit_deducted: depositDeducted,
          net_amount: netAmount,
          status: 'issued',
          notes: `Finalized invoice for deposit group ${group.group_name}`,
        },
        { transaction }
      );

      // Set group status to fulfilled if no remaining quantity, else active; lock editing could be handled by status
      await group.update(
        {
          status: group.remaining_quantity <= 0 ? 'fulfilled' : 'active',
        },
        { transaction }
      );

      await transaction.commit();
      return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      await transaction.rollback();
      console.error('Error finalizing deposit group:', error);
      return res.status(500).json({ error: 'Failed to finalize deposit group' });
    }
  },

  // Edit deposited amount directly (and align balance accordingly)
  async updateDepositAmount(req, res) {
    try {
      const { id } = req.params;
      const { deposited_amount } = req.body;
      const group = await DepositGroup.findByPk(id);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const newDeposited = parseFloat(deposited_amount);
      if (isNaN(newDeposited) || newDeposited < 0) return res.status(400).json({ error: 'Invalid deposited_amount' });
      // Adjust balance by delta between new and old deposited_amount
      const oldDeposited = parseFloat(group.deposited_amount || 0) || 0;
      const delta = newDeposited - oldDeposited;
      group.deposited_amount = newDeposited;
      group.balance = parseFloat(group.balance || 0) + delta;
      await group.save();
      return res.json({ success: true, data: group });
    } catch (error) {
      console.error('Error updating deposit amount:', error);
      return res.status(500).json({ error: 'Failed to update deposit amount' });
    }
  },

  // Add to deposited amount (top-up). This increases both deposited_amount and balance
  async addDepositTopUp(req, res) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const topUp = parseFloat(amount);
      if (isNaN(topUp) || topUp <= 0) return res.status(400).json({ error: 'Invalid amount' });
      const { DepositGroupTopup } = require("../../models");
      const group = await DepositGroup.findByPk(id);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      group.deposited_amount = parseFloat(group.deposited_amount || 0) + topUp;
      group.balance = parseFloat(group.balance || 0) + topUp;
      await group.save();
      await DepositGroupTopup.create({ group_id: group.id, amount: topUp, description: 'Top-up' });
      return res.json({ success: true, data: group });
    } catch (error) {
      console.error('Error topping up deposit:', error);
      return res.status(500).json({ error: 'Failed to top-up deposit' });
    }
  },
  async finalizeDOAmount(req, res) {
    const { do_id } = req.params; // ✅ Use the correct parameter name
    const { finalized_amount } = req.body;

    try {
      const deliveryOrder = await DeliveryOrder.findByPk(do_id); // Now uses the correct ID
      if (!deliveryOrder) {
        return res.status(404).json({ error: 'Delivery Order not found' });
      }

      await deliveryOrder.update({
        final_amount: finalized_amount,
        is_amount_finalized: true
      });

      res.json({ success: true, message: 'Amount finalized successfully', deliveryOrder });
    } catch (error) {
      console.error('Error finalizing DO amount:', error);
      res.status(500).json({ error: 'Failed to finalize amount' });
    }
  },

  // Get all groups with calculated status
  async getAllGroups(req, res) {
    try {
      const groups = await DepositGroup.findAll({});
      
      // Calculate status for each group
      const groupsWithStatus = await Promise.all(groups.map(async group => {
        // Determine status based on deposit-group invoices and payments
        const invoices = await require('../../models').DepositGroupInvoice.findAll({ where: { group_id: group.id } });
        const payments = await require('../../models').DepositGroupPayment.findAll({
          include: [{ model: require('../../models').DepositGroupInvoice, as: 'invoice', where: { group_id: group.id } }]
        });
        const totalNet = invoices.reduce((s, inv) => s + Number(inv.net_amount || 0), 0);
        const totalPaid = payments.reduce((s, p) => s + Number(p.payment_amount || 0), 0);
        const remaining = Math.max(0, totalNet - totalPaid);

        let status = 'normal';
        if (remaining > 0) status = 'butuh bayar';
        if (remaining === 0 && invoices.length > 0) status = 'lunas';
        
        return {
          ...group.get({ plain: true }),
          status
        };
      }));
      
      res.json(groupsWithStatus);
    } catch (error) {
      console.error("Error fetching deposit groups:", error);
      res.status(500).json({ error: "Failed to fetch deposit groups" });
    }
  },

  // Add to depositGroup.controller.js
  async payExtraCharge(req, res) {
    const { memberId } = req.params;
    const userId = req.user?.id;

    try {
      // Find the group member
      const member = await DepositGroupMember.findByPk(memberId, {
        include: [
          {
            model: DeliveryOrder,
            as: 'deliveryOrder',
            attributes: ['id', 'unit_price', 'minimal_load_quantity']
          }
        ]
      });

      if (!member) {
        return res.status(404).json({ error: "Group member not found" });
      }

      const doItem = member.deliveryOrder;
      
      // Calculate extra amount
      const extraQuantity = member.quantity - doItem.minimal_load_quantity;
      const extraAmount = extraQuantity * doItem.unit_price;
      
      if (extraAmount <= 0) {
        return res.status(400).json({ error: "No extra charge to pay" });
      }

      // Find ALL payments for this DO
      const payments = await DeliveryOrderPayments.findAll({
        where: { delivery_order_id: doItem.id }
      });

      let totalPaid = 0;
      let mainPayment = null;

      // Calculate total paid and find the main payment
      payments.forEach(payment => {
        totalPaid += parseFloat(payment.payment_amount);
        if (!payment.payment_type || payment.payment_type === 'check') {
          mainPayment = payment;
        }
      });

      // Calculate total expected payment
      const totalExpected = doItem.minimal_load_quantity * doItem.unit_price + extraAmount;
      
      // Update the main payment
      if (mainPayment) {
        // Calculate how much we need to add to reach the total expected
        const amountToAdd = totalExpected - totalPaid;
        
        await mainPayment.update({
          payment_amount: parseFloat(mainPayment.payment_amount) + amountToAdd,
          payment_date: new Date()
        });
      } else {
        // Create new payment if none exists
        mainPayment = await DeliveryOrderPayments.create({
          delivery_order_id: doItem.id,
          payment_amount: totalExpected,
          payment_date: new Date(),
          payment_type: 'check',
          created_by: userId
        });
      }

      // Update delivery order's actual load quantity
      await DeliveryOrder.update({
        actual_load_quantity: member.quantity,
        payment_status: 'lunas' // Mark as fully paid
      }, {
        where: { id: doItem.id }
      });

      res.json({ 
        success: true,
        paymentId: mainPayment.id,
        message: "Extra charge paid successfully"
      });
    } catch (error) {
      console.error("Error paying extra charge:", error);
      res.status(500).json({ error: "Failed to pay extra charge" });
    }
  },

  // Get group details with DO information
async getGroupDetails(req, res) {
  const { id } = req.params;
  try {
    const { DepositGroupTopup } = require("../../models");
    const group = await DepositGroup.findByPk(id, {
      include: [
        {
          model: DepositGroupMember,
          as: "members",
          include: [{
            model: DeliveryOrder,
            as: "deliveryOrder",
            attributes: [
              "id", "do_number", "customer_name", "payment_status",
              "unit_price", "minimal_load_quantity", "actual_load_quantity",
              "total_amount", "final_amount" // Ensure final_amount is included
            ],
          }],
          attributes: ["id", "delivery_order_id", "quantity"]
        },
        {
          model: DepositGroupTopup,
          as: "topups",
          attributes: ["id", "amount", "description", "created_at"],
          required: false
        },
        {
          model: PurchaseOrder,
          as: "purchaseOrders",
          attributes: ["id", "po_number", "customer_name", "status"],
        }
      ]
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    const plainGroup = group.toJSON();

    if (plainGroup.members && plainGroup.members.length > 0) {
      plainGroup.members = await Promise.all(
        plainGroup.members.map(async (member) => {
          if (member.deliveryOrder) {
            const paidAmount = await getTotalPaidAmount(member.deliveryOrder.id);
            member.deliveryOrder.paid_amount = paidAmount;
          }
          return member;
        })
      );
    }
    
    res.json(plainGroup); // Send the modified object

  } catch (error) {
    console.error("Error fetching group details:", error);
    res.status(500).json({ error: "Failed to fetch group details" });
  }
},

  // Update group details
  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const { group_name, balance } = req.body;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (group_name) group.group_name = group_name;
      if (balance !== undefined) group.balance = parseFloat(balance);
      
      await group.save();
      res.json(group);
    } catch (error) {
      console.error("Error updating group:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  },

async updateMemberQuantity(req, res) {
  const { id } = req.params; // member ID
  const { quantity } = req.body;
  
  try {
    // Find the group member and associated delivery order
    const member = await DepositGroupMember.findByPk(id, {
      include: [{
        model: DeliveryOrder,
        as: "deliveryOrder",
        attributes: ['id', 'unit_price', 'minimal_load_quantity']
      }]
    });
    
    if (!member) {
      return res.status(404).json({ error: "Group member not found" });
    }

    const doItem = member.deliveryOrder;
    const unitPrice = parseFloat(doItem.unit_price);
    
    // ✅ NEW: Calculate the delta changes
    const oldQuantity = parseFloat(member.quantity);
    const newQuantity = parseFloat(quantity);
    const qtyDelta = newQuantity - oldQuantity;
    const amountDelta = qtyDelta * unitPrice;
    const newFinalAmount = newQuantity * unitPrice;

    // Update member quantity
    await member.update({ quantity: newQuantity });

    // ✅ NEW: Update DeliveryOrder with actual_load_quantity
    await doItem.update({
      actual_load_quantity: newQuantity,
      total_amount: newFinalAmount,
      final_amount: newFinalAmount
    });

    // ✅ NEW: Update group balance and remaining_quantity
    const group = await DepositGroup.findByPk(member.group_id);
    if (group) {
      // Reduce remaining_quantity and balance by the delta
      group.remaining_quantity = parseFloat(group.remaining_quantity) - qtyDelta;
      group.balance = parseFloat(group.balance) - amountDelta;
      
      // Update status if needed
      if (group.remaining_quantity <= 0) group.status = 'fulfilled';
      else if (group.remaining_quantity < 0) group.status = 'overdrawn';
      
      await group.save();
    }

    res.json({ 
      success: true, 
      member,
      message: "Quantity updated successfully and group totals recalculated"
    });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ error: "Failed to update quantity" });
  }
},
  // Add DO to group
  async addDOToGroup(req, res) {
    try {
      const { group_id, delivery_order_id } = req.body;
      
      // Check if DO already belongs to a group
      const existingMembership = await DepositGroupMember.findOne({
        where: { delivery_order_id }
      });
      
      if (existingMembership) {
        return res.status(400).json({ 
          error: "DO already belongs to another group" 
        });
      }
      
      const membership = await DepositGroupMember.create({
        group_id,
        delivery_order_id
      });
      
      res.status(201).json(membership);
    } catch (error) {
      console.error("Error adding DO to group:", error);
      res.status(500).json({ error: "Failed to add DO to group" });
    }
  },

  // Remove DO from group
  async removeDOFromGroup(req, res) {
    try {
      const { id } = req.params; // membership ID
      
      const membership = await DepositGroupMember.findByPk(id);
      if (!membership) {
        return res.status(404).json({ error: "Membership not found" });
      }
      
      await membership.destroy();
      res.status(204).end();
    } catch (error) {
      console.error("Error removing DO from group:", error);
      res.status(500).json({ error: "Failed to remove DO from group" });
    }
  },

  // Delete entire group
  async deleteGroup(req, res) {
    try {
      const { id } = req.params;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Delete all memberships first
      await DepositGroupMember.destroy({ where: { group_id: id } });
      
      await group.destroy();
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  },

  // Adjust DO price
  async adjustDOPrice(req, res) {
    try {
      const { do_id } = req.params;
      const { new_amount, reason } = req.body;
      const userId = req.user?.id; // Assuming user ID from auth middleware

      const deliveryOrder = await DeliveryOrder.findByPk(do_id);
      if (!deliveryOrder) {
        return res.status(404).json({ error: "Delivery Order not found" });
      }

      const originalAmount = parseFloat(deliveryOrder.final_amount) || parseFloat(deliveryOrder.total_amount) || 0;
      const adjustmentAmount = parseFloat(new_amount) - originalAmount;
      const finalAmount = parseFloat(new_amount);

      if (isNaN(finalAmount) || finalAmount < 0) {
        return res.status(400).json({ error: "Invalid new amount - must be a non-negative number" });
      }

      // Create or update adjustment record
      const existingAdjustment = await DeliveryOrderAdjustments.findOne({
        where: { delivery_order_id: do_id },
      });

      let adjustment;
      if (existingAdjustment) {
        await existingAdjustment.update({
          adjustment_type: 'price_override',
          original_amount,
          adjustment_amount: adjustmentAmount,
          final_amount: finalAmount,
          reason: reason || 'Price finalization',
          approved_by: userId,
          updated_by: userId,
          updated_at: new Date(),
        });
        adjustment = existingAdjustment;
      } else {
        adjustment = await DeliveryOrderAdjustments.create({
          delivery_order_id: do_id,
          adjustment_type: 'price_override',
          original_amount,
          adjustment_amount: adjustmentAmount,
          final_amount: finalAmount,
          reason: reason || 'Price finalization',
          approved_by: userId,
          created_by: userId,
        });
      }

      // Update Delivery Order
      await deliveryOrder.update({
        final_amount: finalAmount,
        price_adjustment_reason: reason || null,
      });

      res.json({
        success: true,
        message: "DO price adjusted successfully - amounts recalculated",
        data: {
          adjustment,
          do_id: deliveryOrder.id,
          old_amount: originalAmount,
          new_amount: finalAmount,
          reason: reason || 'Price finalization',
        },
      });
    } catch (error) {
      console.error("Error adjusting DO price:", error);
      res.status(500).json({ error: "Failed to adjust DO price" });
    }
  },

 async generateSelisihInvoice(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const group = await DepositGroup.findByPk(id, {
        include: [{
          model: DepositGroupMember,
          as: "members",
          include: [{
            model: DeliveryOrder,
            as: "deliveryOrder",
            where: { 
              status: 'completed',
              actual_load_quantity: { [Op.ne]: null },
              has_generated_selisih: false // Only get DOs that haven't been processed for selisih
            },
            required: true
          }]
        }],
        transaction
      });

      if (!group || !group.members || group.members.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: "Group not found or no new completed DOs with selisih to process." });
      }

      let newSelisihAmount = 0;
      let newSelisihDetails = "";
      const processedDoIds = [];

      for (const member of group.members) {
        const doItem = member.deliveryOrder;
        const minimalQty = parseFloat(doItem.minimal_load_quantity);
        const actualQty = parseFloat(doItem.actual_load_quantity);
        const unitPrice = parseFloat(doItem.unit_price);

        if (actualQty > minimalQty) {
          const extraQty = actualQty - minimalQty;
          newSelisihAmount += extraQty * unitPrice;
          newSelisihDetails += `- ${doItem.do_number}: Kelebihan ${extraQty.toFixed(2)} ${doItem.unit || 'ton'}\n`;
          processedDoIds.push(doItem.id);
        }
      }

      if (newSelisihAmount <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: "Tidak ada selisih kuantitas baru untuk ditagihkan." });
      }

      // Update the group with the new selisih
      group.total_selisih_amount = (parseFloat(group.total_selisih_amount) || 0) + newSelisihAmount;
      group.selisih_details = (group.selisih_details || "") + newSelisihDetails;
      group.selisih_status = 'pending';
      group.status = 'pending_selisih';
      await group.save({ transaction });
      
      // Mark the processed DOs so they aren't included next time
      await DeliveryOrder.update(
        { has_generated_selisih: true },
        { where: { id: { [Op.in]: processedDoIds } }, transaction }
      );

      await transaction.commit();

      res.json({
        success: true,
        message: `Tagihan selisih sebesar ${newSelisihAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })} berhasil ditambahkan.`,
        data: group
      });

    } catch (error) {
      await transaction.rollback();
      console.error("Error generating selisih invoice:", error);
      res.status(500).json({ error: "Failed to generate selisih invoice" });
    }
  },


async paySelisih(req, res, next) { // Add next parameter for error handling
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { payment_amount } = req.body;
      const group = await DepositGroup.findByPk(id, { transaction });

      if (!group) {
        await transaction.rollback();
        return res.status(404).json({ error: "Deposit Group not found" });
      }

      if (group.selisih_status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({ message: "No pending selisih to pay for this group." });
      }

      const amountToPay = parseFloat(payment_amount);
      if (isNaN(amountToPay) || amountToPay <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: "Invalid payment amount provided." });
      }

      const currentSelisih = parseFloat(group.total_selisih_amount);
      
      if (Math.abs(amountToPay - currentSelisih) > 0.01) {
        await transaction.rollback();
        return res.status(400).json({ message: `Payment must match the exact selisih amount of Rp ${currentSelisih.toLocaleString('id-ID')}.` });
      }

      const membersWithSelisih = await DepositGroupMember.findAll({
          where: { group_id: id },
          include: [{
              model: DeliveryOrder,
              as: 'deliveryOrder',
              where: {
                  has_generated_selisih: true,
                  payment_status: { [Op.ne]: 'lunas' }
              },
              required: true
          }],
          transaction
      });

      if (membersWithSelisih.length === 0) {
          await transaction.rollback();
          return res.status(400).json({ message: "No delivery orders with unpaid selisih found to apply payment to." });
      }
      
      for (const member of membersWithSelisih) {
          const doItem = member.deliveryOrder;
          const selisihQty = parseFloat(doItem.actual_load_quantity) - parseFloat(doItem.minimal_load_quantity);
          const selisihAmount = selisihQty * parseFloat(doItem.unit_price);

          if (selisihAmount > 0) {
              await DeliveryOrderPayments.create({
                  delivery_order_id: doItem.id,
                  payment_amount: selisihAmount,
                  payment_type: 'transfer',
                  payment_date: new Date(),
                  notes: `Pembayaran Selisih from Deposit Group: ${group.group_name}`,
                  received_by: req.user?.id,
                  created_by: req.user?.id,
              }, { transaction });

              await doItem.update({ payment_status: 'lunas' }, { transaction });
          }
      }

      group.balance = parseFloat(group.balance) - amountToPay;
      group.total_selisih_amount = 0;
      group.selisih_status = 'paid';
      group.status = group.remaining_quantity <= 0 ? 'fulfilled' : 'active';
      await group.save({ transaction });

      await CashTransaction.create({
        transaction_type: 'debit',
        category_id: 2,
        amount: amountToPay,
        description: `Pembayaran selisih untuk Deposit Group: ${group.group_name}`,
        reference_number: `SELISIH-${group.id}-${Date.now()}`,
        account: 'General',
        transaction_date: new Date()
      }, { transaction });

      //. This is the crucial change: Commit is the last step in the try block.
      await transaction.commit();

      //. The response is now sent outside the try block, after a successful commit.
      res.json({
        success: true,
        message: `Payment for selisih has been recorded successfully.`,
        data: group
      });

    } catch (error) {
      //. Now, this will only be called if any of the 'await' calls above it fail.
      await transaction.rollback();
      console.error("Error paying selisih:", error);
      //. Pass the error to the global error handler
      next(error); 
    }
  },

async linkPOToGroup(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { po_id, group_id } = req.body;
    
    // Link PO to deposit group
    const po = await PurchaseOrder.findByPk(po_id, { transaction });
    if (!po) {
      await transaction.rollback();
      return res.status(404).json({ error: 'PO not found' });
    }

    await PurchaseOrder.update(
      { deposit_group_id: group_id },
      { where: { id: po_id }, transaction }
    );

    // Ensure group's target/remaining qty follows PO total_quantity if currently zero
    const group = await DepositGroup.findByPk(group_id, { transaction });
    if (group) {
      const poTotal = parseFloat(po.total_quantity) || 0;
      const needsTarget = !group.target_quantity || parseFloat(group.target_quantity) === 0;
      const needsRemaining = !group.remaining_quantity || parseFloat(group.remaining_quantity) === 0;
      if (poTotal > 0 && (needsTarget || needsRemaining)) {
        await group.update({
          target_quantity: needsTarget ? poTotal : group.target_quantity,
          remaining_quantity: needsRemaining ? poTotal : group.remaining_quantity,
          unit: group.unit || po.unit || 'ton',
        }, { transaction });
      }
    }

    // Find all DOs from this PO that aren't already in deposit groups
    const existingDOs = await DeliveryOrder.findAll({
      where: { purchase_order_id: po_id },
      include: [{
        model: DepositGroupMember,
        as: 'groupMemberships',
        required: false
      }],
      transaction
    });

    // Add DOs to deposit group if they're not already in one
    for (const doItem of existingDOs) {
      const isAlreadyInGroup = doItem.groupMemberships && doItem.groupMemberships.length > 0;
      
      if (!isAlreadyInGroup) {
        await DepositGroupMember.create({
          group_id: group_id,
          delivery_order_id: doItem.id,
          quantity: doItem.minimal_load_quantity
        }, { transaction });
    
        
        console.log(`✅ Retroactively added DO ${doItem.do_number} to deposit group ${group_id} and marked as paid`);
      }
    }

    await transaction.commit();
    
    res.json({
      success: true,
      message: 'PO linked to deposit group and existing DOs added successfully'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error linking PO to group:', error);
    res.status(500).json({ error: 'Failed to link PO to deposit group' });
  }
}


};